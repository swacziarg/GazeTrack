# Backend

Minimal FastAPI API for GazeTrack. This backend exposes stable demo endpoints plus SQLite-backed local persistence for synthetic study, session, telemetry, and report flows.

## Install

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
cd backend
uvicorn app.main:app --reload
```

SQLite is initialized automatically on startup. By default the database is written to `./gazetrack_demo.db` from the backend working directory. Override it with:

```bash
GAZETRACK_DATABASE_URL=sqlite:///./my_local_gazetrack.db uvicorn app.main:app --reload
```

`backend/.venv/` and `backend/gazetrack_demo.db` are local development artifacts and are ignored by git.

## Test

```bash
cd backend
PYTHONPATH=. pytest
```

Run only the shared session report JSON Schema validation with:

```bash
cd backend
PYTHONPATH=. pytest tests/test_session_report_schema_contract.py
```

## Endpoints

- `GET /health`
- `GET /api/v1/meta`
- `POST /api/v1/studies`
- `GET /api/v1/studies`
- `GET /api/v1/studies/{study_id}`
- `POST /api/v1/studies/{study_id}/tasks`
- `GET /api/v1/studies/{study_id}/tasks`
- `POST /api/v1/studies/{study_id}/aois`
- `GET /api/v1/studies/{study_id}/aois`
- `POST /api/v1/studies/{study_id}/sessions`
- `POST /api/v1/sessions/{session_id}/events`
- `POST /api/v1/sessions/{session_id}/complete`
- `GET /api/v1/sessions/{session_id}/report`
- `GET /api/v1/capture/config?study_id=...&capture_token=...`
- `POST /api/v1/capture/sessions`
- `POST /api/v1/capture/sessions/{session_id}/aoi-snapshots`
- `POST /api/v1/capture/sessions/{session_id}/events`
- `POST /api/v1/capture/sessions/{session_id}/complete`

The `/api/v1/capture/...` namespace is the public website capture boundary used by the versioned SDK. It requires a study capture token and preserves the older dashboard/demo endpoints for local synthetic flows.

## SQLite demo persistence

`POST /api/v1/sessions/{session_id}/events` validates incoming synthetic telemetry and compatible privacy-safe browser-gaze-shaped telemetry, then stores accepted events in SQLite keyed by `session_id`. Rejected media-like payloads, invalid coordinates, invalid confidence values, invalid timestamps, oversized payloads, and unscoped WebGazer samples are not stored.

The local schema includes:

- `studies`
- `tasks`
- `aois`
- `sessions`
- `telemetry_events`
- `reports`

The schema keeps UUID/string IDs, timestamp fields, append-only telemetry events, sanitized JSON payloads stored as text, and queryable canonical telemetry columns (`event_schema_version`, `telemetry_source`, normalized point, confidence, payload byte size, AOI hit count, and `ingested_at`) so the shape can migrate to PostgreSQL/Supabase later.

`GET /api/v1/studies` ensures the default synthetic demo study exists. The default study also receives one demo task and five placeholder AOIs when no tasks/AOIs exist.

AOIs use normalized coordinates from 0 to 1:

- `x`, `y`: top-left coordinate
- `width`, `height`: normalized dimensions
- an event point is inside an AOI when it falls within the inclusive rectangle bounds

`GET /api/v1/sessions/{session_id}/report` returns and persists a backend-generated demo report from stored privacy-safe telemetry, including executive summary bullets, quality interpretation, AOI attention ranking, first/most/weak attention callouts, recommended next actions, event counts, event type counts, first/last event timestamps, gaze-event presence, low-confidence sample rate, click/scroll/calibration/task counts, task/AOI counts, AOI gaze/click metrics, TTFF from task start when available, CAF-style click-after-fixation delay when available, fixation summary, replay overlay data, heuristic quality summary, and privacy-first insights.

Synthetic calibration events may include target/observed normalized points, `error_px`, `error_normalized`, `calibration_step`, `calibration_point_count`, `calibration_points_completed`, and confidence. The parser remains defensive and backwards compatible with aggregate `calibration_error_px` and `calibration_error_normalized` fields.

AOI metrics include both raw sample fields and fixation-derived fields:

- `gaze_sample_count`, `first_gaze_timestamp`, `approximate_dwell_ms`, and `click_count_inside_aoi` preserve the original sample/click behavior.
- `dwell_time_ms`, `fixation_count`, `fixation_dwell_ms`, `first_fixation_timestamp`, `time_to_first_fixation_ms`, `click_after_fixation_ms`, `attention_share_pct`, and optional `average_fixation_confidence` are derived from detected fixation centroids inside the normalized AOI rectangle.

`approximate_dwell_ms` remains a deterministic raw-sample approximation: gaze samples inside an AOI are sorted by timestamp and bounded gaps up to 500 ms are summed. ISO timestamps are supported, and parser helpers also accept numeric seconds or milliseconds for service-level compatibility. If timestamps cannot be parsed, the fallback is `gaze_sample_count * 100 ms`.

Fixations use `simple_dispersion_v1`, a demo-grade normalized-coordinate clustering helper. Accepted gaze samples with usable 0-1 coordinates are sorted by timestamp, grouped when consecutive samples are within a small normalized radius and timestamp gap, and promoted to a fixation when they meet minimum sample and duration thresholds. This is not medical-grade eye tracking and does not claim perfect gaze accuracy.

Calibration/session quality is heuristic. Reports include `quality_verdict` (`pass`, `warn`, or `fail`) and `quality_reasons` based on accepted gaze presence, low-confidence rate, calibration error when present, sample completeness, and whether fixation candidates were detected.

Report replay fields are generated from already persisted telemetry and computed fixations:

- `replay_summary` counts gaze, fixation, click, scroll, and task events, with `duration_ms` and `coordinate_space: "normalized"`.
- `replay_events` is an ordered privacy-safe timeline with event type, timestamp, relative time, optional normalized point, confidence, AOI hits, label/message, page, source, and viewport scroll metadata when captured.
- `replay_fixations` contains replay-friendly fixation centroids with start/end relative time, duration, sample count, optional confidence, and AOI hits.
- `replay_aoi_overlay` contains normalized AOI boxes for schematic rendering.
- `page_layouts` contains safe DOM layout metadata for real-site reports: page URL/path, viewport/document dimensions, scroll offsets, AOI rectangles, safe text snippets, basic visual style metadata, and semantic element boxes.

Replay is not video replay. It does not persist or return raw payloads wholesale, webcam frames, images, screenshots, blobs, base64 media, face embeddings, or face landmarks from webcam processing.

## Intentional limitations

- No authentication/authorization yet.
- No Supabase wiring yet.
- No bundled or production WebGazer integration.
- No production-grade webcam tracking implementation.
- No screenshot uploads or DOM-derived AOI detection.
- No production analytics jobs, background workers, or medical-grade fixation detection.
- No production video/session replay engine.
- No raw webcam video/image/frame/base64/blob storage.
