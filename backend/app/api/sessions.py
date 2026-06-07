from uuid import UUID, uuid4

from fastapi import APIRouter

from app.models.api import (
    EventEnvelope,
    SessionCompleteResponse,
    SessionCreateRequest,
    SessionReportResponse,
    SessionResponse,
)
from app.services import session_store

router = APIRouter(tags=["sessions"])

LOW_CONFIDENCE_THRESHOLD = 0.5
MAX_DEMO_EVENT_SCORE_COUNT = 10


@router.post("/studies/{study_id}/sessions", response_model=SessionResponse)
def create_session(study_id: UUID, payload: SessionCreateRequest) -> SessionResponse:
    _ = payload
    session_id = uuid4()
    session_store.initialize_session(session_id)
    return SessionResponse(session_id=session_id, study_id=study_id, status="started")


@router.post("/sessions/{session_id}/complete", response_model=SessionCompleteResponse)
def complete_session(session_id: UUID) -> SessionCompleteResponse:
    record = session_store.mark_completed(session_id)
    return SessionCompleteResponse(session_id=session_id, event_count=len(record.events), completed=record.completed)


def _event_type_counts(events: list[EventEnvelope]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for event in events:
        event_type = event.event_type.value
        counts[event_type] = counts.get(event_type, 0) + 1
    return counts


def _gaze_confidences(events: list[EventEnvelope]) -> list[float]:
    confidences: list[float] = []
    for event in events:
        if event.event_type.value != "gaze":
            continue
        confidence = event.payload.get("confidence")
        if isinstance(confidence, int | float):
            confidences.append(float(confidence))
    return confidences


def _low_confidence_sample_rate(confidences: list[float]) -> float | None:
    if not confidences:
        return None
    low_count = sum(1 for confidence in confidences if confidence < LOW_CONFIDENCE_THRESHOLD)
    return round(low_count / len(confidences), 3)


def _session_quality_score(events: list[EventEnvelope], confidences: list[float]) -> float | None:
    if not events:
        return None

    sample_integrity = min(len(events) / MAX_DEMO_EVENT_SCORE_COUNT, 1.0)
    confidence_score = sum(confidences) / len(confidences) if confidences else 0.7
    score = (sample_integrity * 0.4 + confidence_score * 0.6) * 100
    return round(score, 1)


@router.get("/sessions/{session_id}/report", response_model=SessionReportResponse)
def get_session_report(session_id: UUID) -> SessionReportResponse:
    events = session_store.get_events(session_id)
    event_count = len(events)
    event_type_counts = _event_type_counts(events)
    confidences = _gaze_confidences(events)
    low_confidence_rate = _low_confidence_sample_rate(confidences)
    quality_score = _session_quality_score(events, confidences)
    first_event_timestamp = events[0].timestamp if events else None
    last_event_timestamp = events[-1].timestamp if events else None
    insights = [
        (
            "Backend demo report generated from in-memory synthetic telemetry."
            if events
            else "No telemetry events have been ingested for this session yet."
        ),
        "No raw webcam media is stored by GazeTrack.",
    ]

    return SessionReportResponse(
        session_id=session_id,
        event_count=event_count,
        event_type_counts=event_type_counts,
        first_event_timestamp=first_event_timestamp,
        last_event_timestamp=last_event_timestamp,
        contains_gaze_events=event_type_counts.get("gaze", 0) > 0,
        low_confidence_sample_rate=low_confidence_rate,
        session_quality_score=quality_score,
        completed=session_store.is_completed(session_id),
        insights=insights,
        metrics={
            "event_count": event_count,
            "event_type_counts": event_type_counts,
            "quality": {
                "score": quality_score,
                "low_confidence_threshold": LOW_CONFIDENCE_THRESHOLD,
                "low_confidence_sample_rate": low_confidence_rate,
            },
        },
        notes=[
            "Backend report is computed from process-local demo memory only.",
            "Storage resets when the server restarts.",
        ],
    )
