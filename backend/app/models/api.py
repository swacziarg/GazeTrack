"""API request/response models for placeholder backend routes.

Privacy note:
These models intentionally exclude video/image/frame/base64/blob fields.
Only telemetry metadata and interaction event payloads are accepted.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class APIStatus(BaseModel):
    status: Literal["ok"] = "ok"


class MetaResponse(BaseModel):
    project: str = "GazeOps"
    version: str = "0.1.0"
    status: str = "placeholder"
    privacy_posture: str = "No raw webcam video storage; telemetry-only placeholders."
    implemented_capabilities: list[str]


class StudyCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    objective: str | None = Field(default=None, max_length=1000)
    target_url: str | None = None


class StudyResponse(BaseModel):
    study_id: UUID
    name: str
    objective: str | None = None
    target_url: str | None = None
    status: Literal["placeholder"] = "placeholder"
    persistence: Literal["not_implemented"] = "not_implemented"
    created_at: str = Field(default_factory=utcnow_iso)


class SessionCreateRequest(BaseModel):
    tester_id: str | None = Field(default=None, max_length=128)
    device_type: str | None = Field(default=None, max_length=64)


class SessionResponse(BaseModel):
    session_id: UUID
    study_id: UUID
    status: Literal["started", "completed"]
    persistence: Literal["not_implemented"] = "not_implemented"


class EventType(str, Enum):
    gaze = "gaze"
    click = "click"
    scroll = "scroll"
    task_start = "task_start"
    task_complete = "task_complete"
    calibration = "calibration"
    quality = "quality"
    page_view = "page_view"


class EventEnvelope(BaseModel):
    event_type: EventType
    timestamp: str
    payload: dict[str, Any] = Field(default_factory=dict)


class EventBatchRequest(BaseModel):
    events: list[EventEnvelope] = Field(min_length=1)


class EventIngestResponse(BaseModel):
    session_id: UUID
    accepted_count: int
    rejected_count: int
    note: str
    rejected_reasons: list[str] = Field(default_factory=list)


class SessionCompleteResponse(BaseModel):
    session_id: UUID
    status: Literal["completed"] = "completed"
    analytics: Literal["not_computed"] = "not_computed"


class SessionReportResponse(BaseModel):
    session_id: UUID
    study_id: UUID | None = None
    report_status: Literal["placeholder"] = "placeholder"
    generated_at: str = Field(default_factory=utcnow_iso)
    metrics: dict[str, Any] = Field(default_factory=dict)
    notes: list[str] = Field(
        default_factory=lambda: [
            "Analytics are not computed yet.",
            "Persistence is not implemented yet.",
        ]
    )


class StudyFactory:
    @staticmethod
    def create_from_request(request: StudyCreateRequest, study_id: UUID | None = None) -> StudyResponse:
        return StudyResponse(
            study_id=study_id or uuid4(),
            name=request.name,
            objective=request.objective,
            target_url=request.target_url,
        )
