"""API request/response models for placeholder backend routes.

Privacy note:
These models intentionally exclude video/image/frame/base64/blob fields.
Only telemetry metadata and interaction event payloads are accepted.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, model_validator


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class APIStatus(BaseModel):
    status: Literal["ok"] = "ok"


class MetaResponse(BaseModel):
    project: str = "GazeTrack"
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
    status: Literal["placeholder", "active"] = "active"
    persistence: Literal["not_implemented", "sqlite"] = "sqlite"
    created_at: str = Field(default_factory=utcnow_iso)
    updated_at: str | None = None


class TaskCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    prompt: str = Field(min_length=1, max_length=1000)
    success_criteria: str | None = Field(default=None, max_length=1000)
    target_url: str | None = None


class TaskResponse(BaseModel):
    task_id: UUID
    study_id: UUID
    title: str
    prompt: str
    success_criteria: str | None = None
    target_url: str | None = None
    created_at: str


class AoiCreateRequest(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    semantic_type: str | None = Field(default=None, max_length=64)
    page_url: str | None = None
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)
    coordinate_space: Literal["normalized"] = "normalized"

    @model_validator(mode="after")
    def validate_bounds(self) -> "AoiCreateRequest":
        if self.x + self.width > 1:
            raise ValueError("AOI x + width must be <= 1 for normalized coordinates")
        if self.y + self.height > 1:
            raise ValueError("AOI y + height must be <= 1 for normalized coordinates")
        return self


class AoiResponse(BaseModel):
    aoi_id: UUID
    study_id: UUID
    label: str
    semantic_type: str | None = None
    page_url: str | None = None
    x: float
    y: float
    width: float
    height: float
    coordinate_space: str = "normalized"
    created_at: str


class StudyTaskConfigRequest(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    prompt: str = Field(min_length=1, max_length=1000)
    success_criteria: str | None = Field(default=None, max_length=1000)
    target_url: str | None = None


class StudyConfigurationRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    objective: str | None = Field(default=None, max_length=1000)
    target_url: str | None = None
    tasks: list[StudyTaskConfigRequest] = Field(min_length=1)
    aois: list[AoiCreateRequest] = Field(min_length=1)


class StudyConfigurationResponse(BaseModel):
    study: StudyResponse
    tasks: list[TaskResponse]
    aois: list[AoiResponse]


class SessionCreateRequest(BaseModel):
    tester_id: str | None = Field(default=None, max_length=128)
    device_type: str | None = Field(default=None, max_length=64)


class SessionResponse(BaseModel):
    session_id: UUID
    study_id: UUID
    status: Literal["started", "completed"]
    persistence: Literal["not_implemented", "sqlite"] = "sqlite"


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
    stored_count_for_session: int = 0
    note: str
    rejected_reasons: list[str] = Field(default_factory=list)


class SessionCompleteResponse(BaseModel):
    session_id: UUID
    status: Literal["completed"] = "completed"
    event_count: int = 0
    completed: bool = True
    analytics: Literal["not_computed", "persisted_report_ready"] = "persisted_report_ready"


class AoiMetricResponse(BaseModel):
    aoi_id: UUID
    label: str
    page_url: str | None = None
    coordinate_space: str = "normalized"
    gaze_sample_count: int = 0
    first_gaze_timestamp: str | None = None
    approximate_dwell_ms: int = 0
    dwell_time_ms: int = 0
    click_count_inside_aoi: int = 0
    click_count: int = 0
    fixation_count: int = 0
    fixation_dwell_ms: int = 0
    first_fixation_timestamp: str | None = None
    time_to_first_fixation_ms: int | None = None
    click_after_fixation_ms: int | None = None
    attention_share_pct: float = 0
    average_fixation_confidence: float | None = None


class AoiInsightResponse(BaseModel):
    aoi_id: UUID
    label: str
    dwell_time_ms: int = 0
    fixation_count: int = 0
    time_to_first_fixation_ms: int | None = None
    click_count: int = 0
    click_after_fixation_ms: int | None = None
    attention_share_pct: float = 0


class AoiAttentionRankingItemResponse(AoiInsightResponse):
    rank: int
    attention_score: float = 0


class QualityInterpretationResponse(BaseModel):
    label: Literal["Usable", "Use with caution", "Limited"]
    explanation: str


class ReplaySummaryResponse(BaseModel):
    event_count: int = 0
    gaze_event_count: int = 0
    fixation_count: int = 0
    click_count: int = 0
    scroll_count: int = 0
    task_event_count: int = 0
    duration_ms: int = 0
    coordinate_space: Literal["normalized"] = "normalized"


class ReplayEventResponse(BaseModel):
    id: str
    type: str
    timestamp: str
    relative_ms: int | None = None
    x: float | None = None
    y: float | None = None
    confidence: float | None = None
    aoi_ids: list[UUID] = Field(default_factory=list)
    label: str | None = None
    message: str | None = None
    source: str | None = None


class ReplayFixationResponse(BaseModel):
    id: str
    type: Literal["fixation"] = "fixation"
    start_timestamp: str
    end_timestamp: str
    start_relative_ms: int | None = None
    end_relative_ms: int | None = None
    duration_ms: int
    x: float
    y: float
    sample_count: int
    average_confidence: float | None = None
    aoi_ids: list[UUID] = Field(default_factory=list)


class ReplayAoiOverlayResponse(BaseModel):
    id: UUID
    label: str
    x: float
    y: float
    width: float
    height: float
    coordinate_space: Literal["normalized"] = "normalized"


class SessionReportResponse(BaseModel):
    session_id: UUID
    study_id: UUID | None = None
    study_name: str | None = None
    study_objective: str | None = None
    target_url: str | None = None
    analytics_version: str = "fixation_demo_v1"
    report_status: Literal["placeholder", "persisted"] = "persisted"
    generated_at: str = Field(default_factory=utcnow_iso)
    event_count: int = 0
    event_type_counts: dict[str, int] = Field(default_factory=dict)
    first_event_timestamp: str | None = None
    last_event_timestamp: str | None = None
    contains_gaze_events: bool = False
    low_confidence_sample_rate: float | None = None
    session_quality_score: float | None = None
    tracker_type: str = "unknown"
    tracker_mode_label: str = "Unknown telemetry source"
    tracker_experimental: bool = False
    tracker_notice: str | None = None
    task_count: int = 0
    task_prompts: list[str] = Field(default_factory=list)
    aoi_count: int = 0
    has_aoi_metrics: bool = False
    aoi_metrics: list[AoiMetricResponse] = Field(default_factory=list)
    report_summary: list[str] = Field(default_factory=list)
    quality_interpretation: QualityInterpretationResponse = Field(
        default_factory=lambda: QualityInterpretationResponse(
            label="Limited",
            explanation="No gaze telemetry has been accepted yet, so interpretation is limited.",
        )
    )
    aoi_attention_ranking: list[AoiAttentionRankingItemResponse] = Field(default_factory=list)
    first_noticed_aoi: AoiInsightResponse | None = None
    most_attended_aoi: AoiInsightResponse | None = None
    weak_or_ignored_aois: list[AoiInsightResponse] = Field(default_factory=list)
    recommended_next_actions: list[str] = Field(default_factory=list)
    completed: bool = False
    insights: list[str] = Field(default_factory=list)
    metrics: dict[str, Any] = Field(default_factory=dict)
    privacy_summary: dict[str, Any] = Field(default_factory=dict)
    fixation_summary: dict[str, Any] = Field(default_factory=dict)
    quality_summary: dict[str, Any] = Field(default_factory=dict)
    replay_summary: ReplaySummaryResponse = Field(default_factory=ReplaySummaryResponse)
    replay_events: list[ReplayEventResponse] = Field(default_factory=list)
    replay_fixations: list[ReplayFixationResponse] = Field(default_factory=list)
    replay_aoi_overlay: list[ReplayAoiOverlayResponse] = Field(default_factory=list)
    notes: list[str] = Field(
        default_factory=lambda: [
            "Analytics are simple deterministic demo metrics.",
            "Storage uses local SQLite by default and is not production infrastructure.",
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
