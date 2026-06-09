from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, Request

from app.api.capture_security import ensure_capture_origin_allowed
from app.api.events import ingest_event_payload
from app.api.studies import _capture_config_inputs, _capture_config_response
from app.models.api import (
    AoiSnapshotBatchRequest,
    AoiSnapshotResponse,
    CaptureConfigResponse,
    CaptureSessionCompleteRequest,
    CaptureSessionStartRequest,
    EventIngestResponse,
    SessionCompleteResponse,
    SessionResponse,
)
from app.repository import AoiSnapshotRecord, get_repository

router = APIRouter(prefix="/capture", tags=["capture"])


def _ensure_valid_capture_token(study_id: UUID, capture_token: str, request: Request) -> None:
    repository = get_repository()
    if repository.get_study(study_id) is None:
        raise HTTPException(status_code=404, detail="Study not found")
    if not repository.capture_token_matches(study_id, capture_token):
        raise HTTPException(status_code=403, detail="Invalid capture token")
    ensure_capture_origin_allowed(study_id, request.headers.get("origin"))


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


@router.get("/config", response_model=CaptureConfigResponse)
def get_capture_config(
    request: Request,
    study_id: UUID = Query(...),
    capture_token: str = Query(..., min_length=1, max_length=200),
) -> CaptureConfigResponse:
    _ensure_valid_capture_token(study_id, capture_token, request)
    study, tasks, aois = _capture_config_inputs(study_id)
    return _capture_config_response(study, tasks, aois)


@router.post("/sessions", response_model=SessionResponse)
def create_capture_session(request: Request, payload: CaptureSessionStartRequest) -> SessionResponse:
    _ensure_valid_capture_token(payload.study_id, payload.capture_token, request)
    record = get_repository().create_session(payload.study_id)
    return SessionResponse(session_id=record.id, study_id=record.study_id, status="started")


@router.post("/sessions/{session_id}/aoi-snapshots", response_model=list[AoiSnapshotResponse])
def replace_capture_aoi_snapshots(
    request: Request,
    session_id: UUID,
    payload: AoiSnapshotBatchRequest,
) -> list[AoiSnapshotResponse]:
    repository = get_repository()
    session = repository.ensure_session(session_id)
    _ensure_valid_capture_token(session.study_id, payload.capture_token, request)
    records = repository.replace_aoi_snapshots(
        session_id,
        [snapshot.model_dump() for snapshot in payload.snapshots],
    )
    return [_snapshot_response(record) for record in records]


@router.post("/sessions/{session_id}/events", response_model=EventIngestResponse)
def ingest_capture_events(request: Request, session_id: UUID, payload: dict[str, Any]) -> EventIngestResponse:
    session = get_repository().ensure_session(session_id)
    ensure_capture_origin_allowed(session.study_id, request.headers.get("origin"))
    return ingest_event_payload(
        session_id=session_id,
        payload=payload,
        require_valid_capture_token=True,
    )


@router.post("/sessions/{session_id}/complete", response_model=SessionCompleteResponse)
def complete_capture_session(
    request: Request,
    session_id: UUID,
    payload: CaptureSessionCompleteRequest,
) -> SessionCompleteResponse:
    repository = get_repository()
    session = repository.ensure_session(session_id)
    _ensure_valid_capture_token(session.study_id, payload.capture_token, request)
    record = repository.complete_session(session_id)
    return SessionCompleteResponse(
        session_id=session_id,
        event_count=repository.count_accepted_events(session_id),
        completed=record.status == "completed",
    )
