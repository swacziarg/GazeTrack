from uuid import UUID, uuid4

from fastapi import APIRouter

from app.models.api import (
    EventEnvelope,
    SessionCompleteResponse,
    SessionCreateRequest,
    SessionReportResponse,
    SessionResponse,
)
from app.repository import get_repository
from app.services.aoi_metrics import compute_aoi_metrics
from app.services.fixations import detect_fixations, summarize_fixations
from app.services.replay import build_replay_aoi_overlay, build_replay_events, build_replay_fixations, build_replay_summary
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
    aois = repository.list_aois_for_study(session.study_id)
    aoi_metrics = compute_aoi_metrics(
        aois,
        events,
        fixations=fixations,
        task_start_timestamp=_first_task_start_timestamp(events),
    )
    replay_events = build_replay_events(events, aois)
    replay_fixations = build_replay_fixations(fixations, events, aois)
    replay_aoi_overlay = build_replay_aoi_overlay(aois)
    replay_summary = build_replay_summary(events, replay_events, replay_fixations)
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
        notes=[
            "Backend report is computed from persisted local SQLite telemetry.",
            "SQLite is the local development store and is intended to migrate to PostgreSQL/Supabase later.",
        ],
    )
    repository.save_report(session_id, report.model_dump(mode="json"))
    return report
