from typing import Any
from uuid import UUID

from fastapi import APIRouter

from app.models.api import EventBatchRequest, EventEnvelope, EventIngestResponse

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

    if "events" in payload:
        try:
            batch = EventBatchRequest.model_validate(payload)
            events = batch.events
        except Exception:
            rejected_reasons.append("Invalid event batch shape")
    else:
        try:
            events = [EventEnvelope.model_validate(payload)]
        except Exception:
            rejected_reasons.append("Invalid single event shape")

    accepted_count = 0
    rejected_count = 0

    for event in events:
        if _contains_media_like_fields(event.payload):
            rejected_count += 1
            rejected_reasons.append(f"Rejected media-like payload fields in event_type={event.event_type.value}")
            continue
        accepted_count += 1

    rejected_count += len(rejected_reasons) if not events else 0

    return EventIngestResponse(
        session_id=session_id,
        accepted_count=accepted_count,
        rejected_count=rejected_count,
        note="Validated placeholder ingest only; persistence is not implemented.",
        rejected_reasons=rejected_reasons,
    )
