from typing import Any
from uuid import UUID

from fastapi import APIRouter
from pydantic import ValidationError

from app.models.api import EventBatchRequest, EventEnvelope, EventIngestResponse
from app.services import session_store

router = APIRouter(tags=["events"])

SUSPICIOUS_MEDIA_KEYS = {"video", "frame", "image", "base64", "blob", "webcam_frame"}


def _contains_media_like_fields(data: Any) -> bool:
    if isinstance(data, dict):
        for key, value in data.items():
            normalized_key = str(key).lower()
            if any(token in normalized_key for token in SUSPICIOUS_MEDIA_KEYS):
                return True
            if _contains_media_like_fields(value):
                return True
    elif isinstance(data, list):
        for item in data:
            if _contains_media_like_fields(item):
                return True
    return False


@router.post("/sessions/{session_id}/events", response_model=EventIngestResponse)
def ingest_events(session_id: UUID, payload: dict[str, Any]) -> EventIngestResponse:
    events: list[EventEnvelope] = []
    rejected_reasons: list[str] = []
    rejected_count = 0

    if "events" in payload:
        try:
            batch = EventBatchRequest.model_validate(payload)
            events = batch.events
        except ValidationError as exc:
            rejected_reasons.append(f"Invalid event batch shape: {exc.errors()[0]['msg']}")
            rejected_count += 1
    else:
        try:
            events = [EventEnvelope.model_validate(payload)]
        except ValidationError as exc:
            rejected_reasons.append(f"Invalid single event shape: {exc.errors()[0]['msg']}")
            rejected_count += 1

    accepted_events: list[EventEnvelope] = []

    for event in events:
        if _contains_media_like_fields(event.payload):
            rejected_count += 1
            rejected_reasons.append(f"Rejected media-like payload fields in event_type={event.event_type.value}")
            continue
        accepted_events.append(event)

    stored_count_for_session = session_store.append_events(session_id, accepted_events) if accepted_events else len(
        session_store.get_events(session_id)
    )

    return EventIngestResponse(
        session_id=session_id,
        accepted_count=len(accepted_events),
        rejected_count=rejected_count,
        stored_count_for_session=stored_count_for_session,
        note="Accepted telemetry is stored in process-local demo memory only and resets on server restart.",
        rejected_reasons=rejected_reasons,
    )
