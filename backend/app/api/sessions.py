from html import escape
import json
from uuid import UUID, uuid4

from fastapi import APIRouter
from fastapi import HTTPException
from fastapi.responses import HTMLResponse

from app.models.api import (
    AoiSnapshotBatchRequest,
    AoiSnapshotResponse,
    EventEnvelope,
    SessionCompleteResponse,
    SessionCreateRequest,
    SessionReportResponse,
    SessionResponse,
)
from app.repository import AoiSnapshotRecord, get_repository
from app.services.aoi_metrics import compute_aoi_metrics
from app.services.fixations import detect_fixations, summarize_fixations
from app.services.replay import (
    build_page_layouts,
    build_replay_aoi_overlay,
    build_replay_events,
    build_replay_fixations,
    build_replay_summary,
)
from app.services.report_insights import (
    aoi_attention_ranking,
    first_noticed_aoi,
    most_attended_aoi,
    quality_interpretation,
    recommended_next_actions,
    report_summary,
    weak_or_ignored_aois,
)
from app.services.session_quality import (
    event_type_counts,
    gaze_confidences,
    low_confidence_sample_rate,
    compute_quality_summary,
)

router = APIRouter(tags=["sessions"])


def _format_ms(value: int | None) -> str:
    if value is None:
        return "Not available"
    if value >= 1000:
        return f"{value / 1000:.1f}s"
    return f"{value}ms"


def _html_list(items: list[str]) -> str:
    if not items:
        return "<p class=\"muted\">No items available.</p>"
    return "<ul>" + "".join(f"<li>{escape(item)}</li>" for item in items) + "</ul>"


def _percent(value: float) -> float:
    return round(max(0, min(1, value)) * 100, 2)


def _timeline_events(report: SessionReportResponse) -> list[dict[str, object]]:
    return [
        event.model_dump(mode="json")
        for event in report.replay_events
        if event.page_url is not None
        or event.x is not None
        or event.y is not None
        or event.scroll_y is not None
    ]


def _aoi_overlay_html(report: SessionReportResponse) -> str:
    return "".join(
        (
            f'<div class="aoi-box" style="left:{_percent(aoi.x)}%;top:{_percent(aoi.y)}%;'
            f'width:{_percent(aoi.width)}%;height:{_percent(aoi.height)}%">'
            f"<span>{escape(aoi.label)}</span></div>"
        )
        for aoi in report.replay_aoi_overlay
    )


def _safe_style_value(value: str | None, fallback: str = "") -> str:
    if not value:
        return fallback
    allowed = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#(),. %-"
    return "".join(character for character in value[:80] if character in allowed) or fallback


def _layout_canvas_html(report: SessionReportResponse, mode: str) -> str:
    page_layouts = report.page_layouts
    if not page_layouts:
        fallback_content = _heatmap_points_html(report) if mode == "heatmap" else '<div id="replay-dot" class="replay-dot"></div>'
        return (
            '<div class="page-canvas" data-page-url="" style="aspect-ratio:16/9">'
            '<div class="viz-grid"></div>'
            f"{_aoi_overlay_html(report)}"
            f"{fallback_content}"
            "</div>"
        )

    canvases: list[str] = []
    for index, layout in enumerate(page_layouts):
        viewport_width = max(float(layout.viewport_width), 1.0)
        viewport_height = max(float(layout.viewport_height), 1.0)
        document_height = max(float(layout.document_height), viewport_height)
        page_height_pct = max(100.0, (document_height / viewport_height) * 100)
        landmark_parts: list[str] = []
        for landmark in layout.landmarks:
            classes = ["layout-box"]
            tag = (landmark.tag or "").lower()
            if landmark.is_aoi:
                classes.append("layout-aoi")
            if tag in {"h1", "h2", "h3", "h4", "p", "a", "button", "label", "li", "input", "textarea", "select"}:
                classes.append("layout-text")
            background = _safe_style_value(landmark.background_color, "rgba(255,255,255,.55)")
            color = _safe_style_value(landmark.text_color, "#374151")
            border = _safe_style_value(landmark.border_color, "rgba(107,114,128,.35)")
            font_size = _safe_style_value(landmark.font_size, "12px")
            font_weight = _safe_style_value(landmark.font_weight, "500")
            text = landmark.text or landmark.label
            landmark_parts.append(
                f'<div class="{" ".join(classes)}" '
                f'style="left:{_percent(landmark.x)}%;top:{_percent(landmark.y)}%;'
                f'width:{_percent(landmark.width)}%;height:{_percent(landmark.height)}%;'
                f'background:{background};border-color:{border};color:{color};'
                f'font-size:{font_size};font-weight:{font_weight}">'
                f"<span>{escape(text)}</span></div>"
            )
        landmarks = "".join(landmark_parts)
        points = _heatmap_points_html(report, layout.page_url) if mode == "heatmap" else ""
        replay_dot = '<div id="replay-dot" class="replay-dot"></div>' if mode == "replay" and index == 0 else ""
        frame_classes = "screen-frame" if mode == "replay" else "screen-frame heatmap-frame"
        if mode == "replay" and index > 0:
            frame_classes += " is-hidden"
        canvases.append(
            f'<div class="{frame_classes}" data-page-url="{escape(layout.page_url)}" '
            f'data-document-height="{layout.document_height}" data-viewport-height="{layout.viewport_height}" '
            f'style="aspect-ratio:{viewport_width:.0f}/{viewport_height:.0f};">'
            '<div class="browser-bar"><span></span><span></span><span></span>'
            f'<strong>{escape(layout.page_path or layout.page_url)}</strong></div>'
            f'<div class="page-canvas" style="height:{page_height_pct:.2f}%">'
            '<div class="viz-grid"></div>'
            f"{landmarks}{points}{replay_dot}</div></div>"
        )
    return "".join(canvases)


def _heatmap_points_html(report: SessionReportResponse, page_url: str | None = None) -> str:
    points = [
        event
        for event in report.replay_events
        if event.x is not None and event.y is not None and event.type == "gaze"
        and (page_url is None or event.page_url == page_url)
    ]
    if not points:
        return ""
    return "".join(
        (
            f'<span class="heat-point" style="left:{_percent(float(event.x))}%;top:{_percent(float(event.y))}%;'
            f'opacity:{0.24 + min(0.45, float(event.confidence or 0.5) * 0.35):.2f}"></span>'
        )
        for event in points[:240]
    )


def _replay_payload_json(report: SessionReportResponse) -> str:
    payload = {
        "durationMs": report.replay_summary.duration_ms,
        "events": _timeline_events(report),
        "pageUrls": [layout.page_url for layout in report.page_layouts],
    }
    return json.dumps(payload).replace("<", "\\u003c")


def _render_session_report_html(report: SessionReportResponse) -> str:
    event_counts = "".join(
        f"<tr><td>{escape(event_type)}</td><td>{count}</td></tr>"
        for event_type, count in sorted(report.event_type_counts.items())
    ) or "<tr><td colspan=\"2\">No events accepted yet.</td></tr>"
    ranking = "".join(
        (
            f"<tr><td>{item.rank}</td><td>{escape(item.label)}</td>"
            f"<td>{item.attention_share_pct:.1f}%</td><td>{_format_ms(item.dwell_time_ms)}</td>"
            f"<td>{item.click_count}</td></tr>"
        )
        for item in report.aoi_attention_ranking
    ) or "<tr><td colspan=\"5\">No AOI attention ranking available.</td></tr>"
    aoi_metrics = "".join(
        (
            f"<tr><td>{escape(metric.label)}</td><td>{metric.gaze_sample_count}</td>"
            f"<td>{metric.fixation_count}</td><td>{_format_ms(metric.fixation_dwell_ms)}</td>"
            f"<td>{metric.click_count}</td></tr>"
        )
        for metric in report.aoi_metrics
    ) or "<tr><td colspan=\"5\">No AOI metrics available.</td></tr>"
    quality_score = "Not available" if report.session_quality_score is None else f"{report.session_quality_score:.0f}/100"
    raw_json_url = f"/api/v1/sessions/{report.session_id}/report"
    heatmap_canvases = _layout_canvas_html(report, "heatmap")
    replay_canvases = _layout_canvas_html(report, "replay")
    replay_payload = _replay_payload_json(report)

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GazeTrack Report</title>
  <style>
    body {{ margin: 0; background: #f8fafc; color: #111827; font: 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
    main {{ max-width: 1120px; margin: 0 auto; padding: 32px 20px 56px; }}
    header {{ display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 20px; }}
    h1, h2 {{ margin: 0; line-height: 1.15; }}
    h1 {{ font-size: clamp(28px, 5vw, 44px); }}
    h2 {{ font-size: 18px; margin-bottom: 10px; }}
    .eyebrow {{ color: #0f766e; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; margin: 0 0 8px; }}
    .muted {{ color: #6b7280; }}
    .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }}
    .card {{ background: white; border: 1px solid #d1d5db; border-radius: 8px; padding: 18px; box-shadow: 0 12px 34px rgba(17,24,39,.08); margin-bottom: 16px; }}
    .metric {{ border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; background: #fcfcfd; }}
    .metric dt {{ color: #6b7280; font-size: 12px; margin-bottom: 4px; }}
    .metric dd {{ margin: 0; font-weight: 700; font-size: 18px; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: top; }}
    th {{ color: #374151; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }}
    ul {{ margin: 8px 0 0; padding-left: 20px; }}
    a.button {{ display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; background: #111827; color: white; padding: 9px 12px; text-decoration: none; font-weight: 700; white-space: nowrap; }}
    .notice {{ background: #fffbeb; border-color: #fbbf24; }}
    .viz-shell {{ position: relative; display: grid; gap: 16px; border: 1px solid #d1d5db; border-radius: 8px; background: #e5e7eb; padding: 14px; }}
    .screen-frame {{ position: relative; width: min(100%, 960px); max-height: min(680px, 72vh); margin: 0 auto; overflow: hidden; border: 1px solid #9ca3af; border-radius: 8px; background: #ffffff; box-shadow: 0 18px 44px rgba(17,24,39,.16); }}
    .screen-frame.is-hidden {{ display: none; }}
    .heatmap-frame {{ overflow: auto; }}
    .browser-bar {{ position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; background: #f9fafb; border-bottom: 1px solid #d1d5db; color: #4b5563; font-size: 11px; }}
    .browser-bar span {{ width: 8px; height: 8px; border-radius: 999px; background: #d1d5db; flex: 0 0 auto; }}
    .browser-bar strong {{ min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }}
    .page-canvas {{ position: relative; min-height: 100%; background: linear-gradient(180deg, #ffffff, #eef2f7); transform-origin: top left; transition: transform .18s ease; }}
    .viz-grid {{ position: absolute; inset: 0; background-image: linear-gradient(rgba(17,24,39,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(17,24,39,.06) 1px, transparent 1px); background-size: 10% 10%; }}
    .layout-box {{ position: absolute; border: 1px solid rgba(107,114,128,.38); background: rgba(255,255,255,.42); border-radius: 3px; overflow: hidden; }}
    .layout-box span {{ position: absolute; left: 4px; top: 4px; right: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: inherit; font: inherit; background: rgba(255,255,255,.62); border-radius: 3px; padding: 1px 3px; }}
    .layout-text {{ display: flex; align-items: flex-start; }}
    .layout-text span {{ background: transparent; padding: 0; line-height: 1.2; white-space: normal; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }}
    .layout-aoi {{ border-color: rgba(15,118,110,.75); background: rgba(20,184,166,.08); }}
    .layout-aoi span {{ color: #0f766e; }}
    .aoi-box {{ position: absolute; border: 1px solid rgba(15,118,110,.75); background: rgba(20,184,166,.08); border-radius: 4px; }}
    .aoi-box span {{ position: absolute; left: 4px; top: 4px; max-width: calc(100% - 8px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #0f766e; font-size: 11px; font-weight: 700; background: rgba(255,255,255,.82); border-radius: 4px; padding: 2px 4px; }}
    .heat-point {{ position: absolute; width: 78px; height: 78px; margin: -39px 0 0 -39px; border-radius: 999px; background: radial-gradient(circle, rgba(239,68,68,.72) 0%, rgba(245,158,11,.38) 38%, rgba(20,184,166,0) 72%); mix-blend-mode: multiply; pointer-events: none; }}
    .replay-dot {{ position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 999px; background: #ef4444; border: 2px solid white; box-shadow: 0 0 0 8px rgba(239,68,68,.2), 0 0 20px rgba(239,68,68,.65); transform: translate(-100px, -100px); }}
    .replay-trail {{ position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 999px; background: rgba(239,68,68,.42); }}
    .replay-click {{ position: absolute; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 999px; border: 2px solid #111827; background: rgba(255,255,255,.72); }}
    .replay-controls {{ display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; }}
    .replay-controls button {{ border: 0; background: #111827; color: white; border-radius: 6px; padding: 9px 12px; font-weight: 700; cursor: pointer; }}
    .replay-controls input {{ flex: 1; min-width: 180px; }}
    .legend {{ display: flex; gap: 12px; flex-wrap: wrap; color: #6b7280; font-size: 12px; margin-top: 8px; }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <p class="eyebrow">GazeTrack report</p>
        <h1>{escape(report.study_name or "Session report")}</h1>
        <p class="muted">{escape(report.study_objective or "Task-based real-site capture report.")}</p>
      </div>
      <a class="button" href="{raw_json_url}">Raw JSON</a>
    </header>

    <section class="card">
      <h2>Overview</h2>
      <dl class="grid">
        <div class="metric"><dt>Session</dt><dd>{escape(str(report.session_id))}</dd></div>
        <div class="metric"><dt>Status</dt><dd>{"Completed" if report.completed else "In progress"}</dd></div>
        <div class="metric"><dt>Tracker</dt><dd>{escape(report.tracker_type)}</dd></div>
        <div class="metric"><dt>Events</dt><dd>{report.event_count}</dd></div>
        <div class="metric"><dt>Quality</dt><dd>{quality_score}</dd></div>
        <div class="metric"><dt>AOIs</dt><dd>{report.aoi_count}</dd></div>
      </dl>
    </section>

    <section class="card">
      <h2>Summary</h2>
      {_html_list(report.report_summary)}
    </section>

    <section class="card">
      <h2>Quality interpretation</h2>
      <p><strong>{escape(report.quality_interpretation.label)}</strong></p>
      <p class="muted">{escape(report.quality_interpretation.explanation)}</p>
    </section>

    <section class="card">
      <h2>Heatmap</h2>
      <p class="muted">Schematic heatmap from accepted normalized gaze samples. It is not a screenshot and does not include raw media.</p>
      <div class="viz-shell" aria-label="Gaze heatmap">
        {heatmap_canvases}
      </div>
      <div class="legend"><span>Red/yellow: denser approximate gaze samples</span><span>Teal boxes: AOIs captured from the page</span></div>
    </section>

    <section class="card">
      <h2>Replay</h2>
      <p class="muted">Task replay uses privacy-safe telemetry points and AOI boxes only.</p>
      <div id="replay-stage" class="viz-shell" aria-label="Session replay">
        {replay_canvases}
      </div>
      <div class="replay-controls">
        <button type="button" id="replay-toggle">Play replay</button>
        <input id="replay-range" type="range" min="0" max="{max(1, report.replay_summary.duration_ms)}" value="0">
        <span id="replay-time" class="muted">0.0s</span>
      </div>
    </section>

    <section class="card">
      <h2>AOI attention ranking</h2>
      <table><thead><tr><th>Rank</th><th>AOI</th><th>Attention share</th><th>Dwell</th><th>Clicks</th></tr></thead><tbody>{ranking}</tbody></table>
    </section>

    <section class="card">
      <h2>AOI metrics</h2>
      <table><thead><tr><th>AOI</th><th>Gaze samples</th><th>Fixations</th><th>Fixation dwell</th><th>Clicks</th></tr></thead><tbody>{aoi_metrics}</tbody></table>
    </section>

    <section class="card">
      <h2>Event counts</h2>
      <table><thead><tr><th>Type</th><th>Count</th></tr></thead><tbody>{event_counts}</tbody></table>
    </section>

    <section class="card">
      <h2>Recommended next actions</h2>
      {_html_list(report.recommended_next_actions)}
    </section>

    <section class="card notice">
      <h2>Privacy boundary</h2>
      <p>No raw webcam video, frames, screenshots, image blobs, face embeddings, or face landmarks are stored. Stored payload type: {escape(str(report.privacy_summary.get("stored_payload_type", "validated JSON telemetry")))}.</p>
      {f"<p>{escape(report.tracker_notice)}</p>" if report.tracker_notice else ""}
    </section>
  </main>
  <script type="application/json" id="replay-data">{replay_payload}</script>
  <script>
    (() => {{
      const data = JSON.parse(document.getElementById('replay-data').textContent || '{{"events":[],"durationMs":0}}');
      const stage = document.getElementById('replay-stage');
      const dot = document.getElementById('replay-dot');
      const toggle = document.getElementById('replay-toggle');
      const range = document.getElementById('replay-range');
      const time = document.getElementById('replay-time');
      const events = (data.events || []).filter((event) =>
        typeof event.x === 'number' ||
        typeof event.y === 'number' ||
        typeof event.scroll_y === 'number' ||
        typeof event.page_url === 'string'
      );
      const duration = Math.max(1, Number(data.durationMs || 0));
      let playing = false;
      let startedAt = 0;
      let raf = 0;
      let trailCount = 0;

      function setTime(ms) {{
        const bounded = Math.max(0, Math.min(duration, ms));
        range.value = String(Math.round(bounded));
        time.textContent = `${{(bounded / 1000).toFixed(1)}}s`;
        const elapsedEvents = events.filter((event) => Number(event.relative_ms || 0) <= bounded);
        const current = elapsedEvents.at(-1);
        if (!current) return;
        const activeFrame = current.page_url
          ? stage.querySelector(`[data-page-url="${{CSS.escape(current.page_url)}}"]`)
          : stage.querySelector('.screen-frame');
        const visibleFrame = activeFrame || stage.querySelector('.screen-frame');
        stage.querySelectorAll('.screen-frame').forEach((frame) => {{
          frame.classList.toggle('is-hidden', frame !== visibleFrame);
        }});
        const activeCanvas = visibleFrame?.querySelector('.page-canvas') || stage.querySelector('.page-canvas') || stage;
        if (dot.parentElement !== activeCanvas) activeCanvas.appendChild(dot);
        const currentPoint = elapsedEvents.filter((event) =>
          typeof event.x === 'number' &&
          typeof event.y === 'number' &&
          (!current.page_url || !event.page_url || event.page_url === current.page_url)
        ).at(-1) || elapsedEvents.filter((event) => typeof event.x === 'number' && typeof event.y === 'number').at(-1);
        const documentHeight = Math.max(Number(visibleFrame?.dataset.documentHeight || current.document_height || 1), 1);
        const viewportHeight = Math.max(Number(current.viewport_height || visibleFrame?.dataset.viewportHeight || documentHeight), 1);
        const scrollY = Math.max(0, Number(current.scroll_y ?? (currentPoint ? ((currentPoint.y * documentHeight) - (viewportHeight / 2)) : 0)));
        const maxScroll = Math.max(documentHeight - viewportHeight, 1);
        const translatePct = Math.max(0, Math.min(100 - ((viewportHeight / documentHeight) * 100), (scrollY / documentHeight) * 100));
        activeCanvas.style.transform = `translateY(-${{translatePct}}%)`;
        stage.dataset.activePageUrl = current.page_url || '';
        stage.dataset.scrollY = String(Math.round(Math.min(scrollY, maxScroll)));
        if (!currentPoint) return;
        const left = `${{Math.max(0, Math.min(100, currentPoint.x * 100))}}%`;
        const top = `${{Math.max(0, Math.min(100, currentPoint.y * 100))}}%`;
        dot.style.left = left;
        dot.style.top = top;
        dot.style.transform = 'translate(0,0)';
        if (currentPoint.type === 'click') {{
          const click = document.createElement('span');
          click.className = 'replay-click';
          click.style.left = left;
          click.style.top = top;
          activeCanvas.appendChild(click);
        }} else if (trailCount % 4 === 0) {{
          const trail = document.createElement('span');
          trail.className = 'replay-trail';
          trail.style.left = left;
          trail.style.top = top;
          activeCanvas.appendChild(trail);
        }}
        trailCount += 1;
      }}

      function tick(timestamp) {{
        if (!startedAt) startedAt = timestamp - Number(range.value || 0);
        const elapsed = timestamp - startedAt;
        setTime(elapsed);
        if (elapsed >= duration) {{
          playing = false;
          toggle.textContent = 'Play replay';
          startedAt = 0;
          return;
        }}
        raf = requestAnimationFrame(tick);
      }}

      toggle.addEventListener('click', () => {{
        playing = !playing;
        toggle.textContent = playing ? 'Pause replay' : 'Play replay';
        if (playing) {{
          startedAt = 0;
          raf = requestAnimationFrame(tick);
        }} else {{
          cancelAnimationFrame(raf);
        }}
      }});
      range.addEventListener('input', () => {{
        cancelAnimationFrame(raf);
        playing = false;
        startedAt = 0;
        toggle.textContent = 'Play replay';
        setTime(Number(range.value || 0));
      }});
      setTime(0);
    }})();
  </script>
</body>
</html>"""


def _snapshot_response(record: AoiSnapshotRecord) -> AoiSnapshotResponse:
    return AoiSnapshotResponse(
        snapshot_id=record.id,
        session_id=record.session_id,
        study_id=record.study_id,
        source_aoi_id=record.source_aoi_id,
        label=record.label,
        semantic_type=record.semantic_type,
        role_key=record.role_key,
        selector=record.selector,
        page_url=record.page_url,
        x=record.x,
        y=record.y,
        width=record.width,
        height=record.height,
        coordinate_space=record.coordinate_space,
        detected=record.detected,
        created_at=record.created_at,
    )


@router.post("/studies/{study_id}/sessions", response_model=SessionResponse)
def create_session(study_id: UUID, payload: SessionCreateRequest) -> SessionResponse:
    _ = payload
    session_id = uuid4()
    record = get_repository().create_session(study_id, session_id=session_id)
    return SessionResponse(session_id=record.id, study_id=record.study_id, status="started")


@router.post("/sessions/{session_id}/complete", response_model=SessionCompleteResponse)
def complete_session(session_id: UUID) -> SessionCompleteResponse:
    repository = get_repository()
    record = repository.complete_session(session_id)
    return SessionCompleteResponse(
        session_id=session_id,
        event_count=repository.count_accepted_events(session_id),
        completed=record.status == "completed",
    )


@router.post("/sessions/{session_id}/aoi-snapshots", response_model=list[AoiSnapshotResponse])
def replace_aoi_snapshots(session_id: UUID, payload: AoiSnapshotBatchRequest) -> list[AoiSnapshotResponse]:
    repository = get_repository()
    session = repository.ensure_session(session_id)
    if not repository.capture_token_matches(session.study_id, payload.capture_token):
        raise HTTPException(status_code=403, detail="Invalid capture token")
    records = repository.replace_aoi_snapshots(
        session_id,
        [snapshot.model_dump() for snapshot in payload.snapshots],
    )
    return [_snapshot_response(record) for record in records]


def _task_event_count(event_type_counts: dict[str, int]) -> int:
    return event_type_counts.get("task_start", 0) + event_type_counts.get("task_complete", 0)


def _first_task_start_timestamp(events: list[EventEnvelope]) -> str | None:
    task_start_timestamps = [event.timestamp for event in events if event.event_type.value == "task_start"]
    return sorted(task_start_timestamps)[0] if task_start_timestamps else None


def _tracker_report_metadata(events: list[EventEnvelope]) -> dict[str, str | bool | None]:
    sources = {
        str(event.payload.get("tracker_type") or event.payload.get("source"))
        for event in events
        if event.payload.get("tracker_type") or event.payload.get("source")
    }

    if "webgazer_experimental" in sources or "webgazer" in sources:
        return {
            "tracker_type": "webgazer_experimental",
            "tracker_mode_label": "Experimental browser gaze",
            "tracker_experimental": True,
            "tracker_notice": (
                "Webcam gaze estimates are approximate, browser-dependent, and not medical-grade eye tracking."
            ),
        }

    if "real_site_capture" in sources:
        return {
            "tracker_type": "real_site_capture",
            "tracker_mode_label": "Real-site capture snippet",
            "tracker_experimental": True,
            "tracker_notice": (
                "Real-site capture uses document-normalized browser telemetry and optional approximate gaze samples."
            ),
        }

    if "synthetic" in sources or any(event.payload.get("synthetic") is True for event in events):
        return {
            "tracker_type": "synthetic",
            "tracker_mode_label": "Synthetic demo telemetry",
            "tracker_experimental": False,
            "tracker_notice": None,
        }

    return {
        "tracker_type": "unknown",
        "tracker_mode_label": "Unknown telemetry source",
        "tracker_experimental": False,
        "tracker_notice": None,
    }


@router.get("/sessions/{session_id}/report", response_model=SessionReportResponse)
def get_session_report(session_id: UUID) -> SessionReportResponse:
    repository = get_repository()
    session = repository.ensure_session(session_id)
    events = [record.to_envelope() for record in repository.get_accepted_events(session_id)]
    event_count = len(events)
    event_counts = event_type_counts(events)
    confidences = gaze_confidences(events)
    low_confidence_rate = low_confidence_sample_rate(confidences)
    fixations = detect_fixations(events)
    fixation_summary = summarize_fixations(fixations)
    quality_summary = compute_quality_summary(events, fixations)
    study = repository.get_study(session.study_id)
    tasks = repository.list_tasks_for_study(session.study_id)
    snapshots = repository.list_aoi_snapshots_for_session(session_id)
    unresolved_snapshot_labels = [snapshot.label for snapshot in snapshots if not snapshot.detected]
    detected_snapshots = [snapshot for snapshot in snapshots if snapshot.detected]
    aois = (
        [snapshot.to_aoi_record() for snapshot in detected_snapshots]
        if snapshots
        else repository.list_aois_for_study(session.study_id)
    )
    aoi_metrics = compute_aoi_metrics(
        aois,
        events,
        fixations=fixations,
        task_start_timestamp=_first_task_start_timestamp(events),
    )
    replay_events = build_replay_events(events, aois)
    replay_fixations = build_replay_fixations(fixations, events, aois)
    replay_aoi_overlay = build_replay_aoi_overlay(aois)
    page_layouts = build_page_layouts(events)
    replay_summary = build_replay_summary(events, replay_events, replay_fixations, aois)
    tracker_metadata = _tracker_report_metadata(events)
    quality_interpretation_payload = quality_interpretation(quality_summary)
    aoi_attention_ranking_payload = aoi_attention_ranking(aoi_metrics)
    first_noticed_aoi_payload = first_noticed_aoi(aoi_metrics)
    most_attended_aoi_payload = most_attended_aoi(aoi_attention_ranking_payload)
    weak_or_ignored_aois_payload = weak_or_ignored_aois(aoi_metrics)
    report_summary_payload = report_summary(
        event_count=event_count,
        quality=quality_interpretation_payload,
        first_noticed=first_noticed_aoi_payload,
        most_attended=most_attended_aoi_payload,
        weak_aois=weak_or_ignored_aois_payload,
    )
    recommended_next_actions_payload = recommended_next_actions(
        quality=quality_interpretation_payload,
        first_noticed=first_noticed_aoi_payload,
        most_attended=most_attended_aoi_payload,
        weak_aois=weak_or_ignored_aois_payload,
        tracker_experimental=bool(tracker_metadata["tracker_experimental"]),
    )
    privacy_summary = {
        "raw_media_stored": False,
        "stored_payload_type": "validated JSON telemetry",
        "media_like_payload_policy": "Rejected before persistence",
        "tracker_type": tracker_metadata["tracker_type"],
    }
    first_event_timestamp = events[0].timestamp if events else None
    last_event_timestamp = events[-1].timestamp if events else None
    insights = [
        (
            "Backend demo report generated from persisted SQLite telemetry."
            if events
            else "No telemetry events have been ingested for this session yet."
        ),
        "No raw webcam media is stored by GazeTrack.",
    ]
    insights.extend(f"AOI not detected on captured page: {label}." for label in unresolved_snapshot_labels)
    if tracker_metadata["tracker_experimental"]:
        insights.append(str(tracker_metadata["tracker_notice"]))
    report = SessionReportResponse(
        session_id=session_id,
        study_id=session.study_id,
        study_name=study.title if study else None,
        study_objective=study.description if study else None,
        target_url=study.target_url if study else None,
        event_count=event_count,
        event_type_counts=event_counts,
        first_event_timestamp=first_event_timestamp,
        last_event_timestamp=last_event_timestamp,
        contains_gaze_events=event_counts.get("gaze", 0) > 0,
        low_confidence_sample_rate=low_confidence_rate,
        session_quality_score=quality_summary["score"],
        tracker_type=str(tracker_metadata["tracker_type"]),
        tracker_mode_label=str(tracker_metadata["tracker_mode_label"]),
        tracker_experimental=bool(tracker_metadata["tracker_experimental"]),
        tracker_notice=(
            str(tracker_metadata["tracker_notice"]) if tracker_metadata["tracker_notice"] is not None else None
        ),
        task_count=len(tasks),
        task_prompts=[task.prompt for task in tasks],
        aoi_count=len(aois),
        has_aoi_metrics=bool(aoi_metrics),
        aoi_metrics=aoi_metrics,
        report_summary=report_summary_payload,
        quality_interpretation=quality_interpretation_payload,
        aoi_attention_ranking=aoi_attention_ranking_payload,
        first_noticed_aoi=first_noticed_aoi_payload,
        most_attended_aoi=most_attended_aoi_payload,
        weak_or_ignored_aois=weak_or_ignored_aois_payload,
        recommended_next_actions=recommended_next_actions_payload,
        completed=session.status == "completed",
        insights=insights,
        metrics={
            "event_count": event_count,
            "event_type_counts": event_counts,
            "click_count": event_counts.get("click", 0),
            "scroll_count": event_counts.get("scroll", 0),
            "calibration_event_count": event_counts.get("calibration", 0),
            "task_event_count": _task_event_count(event_counts),
            "task_count": len(tasks),
            "task_prompts": [task.prompt for task in tasks],
            "aoi_count": len(aois),
            "has_aoi_metrics": bool(aoi_metrics),
            "aoi_metrics": [metric.model_dump(mode="json") for metric in aoi_metrics],
            "fixation_summary": fixation_summary,
            "quality": quality_summary,
            "quality_interpretation": quality_interpretation_payload.model_dump(mode="json"),
            "report_summary": report_summary_payload,
            "aoi_attention_ranking": [item.model_dump(mode="json") for item in aoi_attention_ranking_payload],
            "first_noticed_aoi": (
                first_noticed_aoi_payload.model_dump(mode="json") if first_noticed_aoi_payload else None
            ),
            "most_attended_aoi": (
                most_attended_aoi_payload.model_dump(mode="json") if most_attended_aoi_payload else None
            ),
            "weak_or_ignored_aois": [item.model_dump(mode="json") for item in weak_or_ignored_aois_payload],
            "recommended_next_actions": recommended_next_actions_payload,
            "privacy": privacy_summary,
            "replay_summary": replay_summary,
            "page_layouts": page_layouts,
            "tracker_type": tracker_metadata["tracker_type"],
            "tracker_experimental": tracker_metadata["tracker_experimental"],
        },
        privacy_summary=privacy_summary,
        fixation_summary=fixation_summary,
        quality_summary=quality_summary,
        replay_summary=replay_summary,
        replay_events=replay_events,
        replay_fixations=replay_fixations,
        replay_aoi_overlay=replay_aoi_overlay,
        page_layouts=page_layouts,
        notes=[
            "Backend report is computed from persisted local SQLite telemetry.",
            "SQLite is the local development store and is intended to migrate to PostgreSQL/Supabase later.",
        ],
    )
    repository.save_report(session_id, report.model_dump(mode="json"))
    return report


@router.get("/sessions/{session_id}/report-view", response_class=HTMLResponse)
def get_session_report_view(session_id: UUID) -> HTMLResponse:
    report = get_session_report(session_id)
    return HTMLResponse(_render_session_report_html(report))
