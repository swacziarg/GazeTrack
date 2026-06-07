"""Process-local demo session telemetry storage.

This module intentionally uses in-memory storage for the local development demo.
It resets when the FastAPI process restarts, is not thread-safe, and is not
production persistence. Only validated telemetry event envelopes are stored;
raw webcam media, frames, images, blobs, or base64 payloads must not be stored.
"""

from dataclasses import dataclass, field
from uuid import UUID

from app.models.api import EventEnvelope


@dataclass
class DemoSessionRecord:
    events: list[EventEnvelope] = field(default_factory=list)
    completed: bool = False


_sessions: dict[UUID, DemoSessionRecord] = {}


def initialize_session(session_id: UUID) -> DemoSessionRecord:
    return _sessions.setdefault(session_id, DemoSessionRecord())


def append_events(session_id: UUID, events: list[EventEnvelope]) -> int:
    record = initialize_session(session_id)
    record.events.extend(events)
    return len(record.events)


def get_events(session_id: UUID) -> list[EventEnvelope]:
    record = _sessions.get(session_id)
    if record is None:
        return []
    return list(record.events)


def mark_completed(session_id: UUID) -> DemoSessionRecord:
    record = initialize_session(session_id)
    record.completed = True
    return record


def is_completed(session_id: UUID) -> bool:
    record = _sessions.get(session_id)
    return bool(record and record.completed)


def reset_store() -> None:
    """Clear demo storage for tests and local reset workflows."""

    _sessions.clear()
