from typing import Any
from uuid import UUID

from fastapi import APIRouter
from pydantic import ValidationError

from app.models.api import EventBatchRequest, EventEnvelope, EventIngestResponse
from app.repository import get_repository
from app.services.event_validation import (
    AcceptedTelemetryEvent,
    REAL_SITE_CAPTURE_SOURCE,
    telemetry_source,
    validate_event_for_ingest,
)

router = APIRouter(tags=["events"])


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

    repository = get_repository()
    session = repository.ensure_session(session_id)
    capture_token = payload.get("capture_token")
    real_site_capture_authorized = repository.capture_token_matches(
        session.study_id,
        capture_token if isinstance(capture_token, str) else None,
    )
    has_task_context = repository.session_has_event_type(session_id, "task_start")
    accepted_events: list[AcceptedTelemetryEvent] = []

    for event in events:
        source = telemetry_source(event.payload)
        if source == REAL_SITE_CAPTURE_SOURCE and not real_site_capture_authorized:
            rejected_count += 1
            rejected_reasons.append(f"Rejected real-site event_type={event.event_type.value} with invalid capture token.")
            continue
        result = validate_event_for_ingest(event, has_task_context=has_task_context)
        if result.accepted_event is None:
            rejected_count += 1
            rejected_reasons.append(result.rejection_reason or f"Rejected event_type={event.event_type.value}.")
            continue
        accepted_events.append(result.accepted_event)
        if result.accepted_event.envelope.event_type.value == "task_start":
            has_task_context = True

    stored_count_for_session = (
        repository.append_accepted_events(session_id, accepted_events)
        if accepted_events
        else repository.count_accepted_events(session_id)
    )

    return EventIngestResponse(
        session_id=session_id,
        accepted_count=len(accepted_events),
        rejected_count=rejected_count,
        stored_count_for_session=stored_count_for_session,
        note="Accepted task-scoped, privacy-safe telemetry is stored in local SQLite persistence.",
        rejected_reasons=rejected_reasons,
    )
