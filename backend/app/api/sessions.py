from uuid import UUID, uuid4

from fastapi import APIRouter

from app.models.api import (
    SessionCompleteResponse,
    SessionCreateRequest,
    SessionReportResponse,
    SessionResponse,
)

router = APIRouter(tags=["sessions"])


@router.post("/studies/{study_id}/sessions", response_model=SessionResponse)
def create_session(study_id: UUID, payload: SessionCreateRequest) -> SessionResponse:
    _ = payload
    return SessionResponse(session_id=uuid4(), study_id=study_id, status="started")


@router.post("/sessions/{session_id}/complete", response_model=SessionCompleteResponse)
def complete_session(session_id: UUID) -> SessionCompleteResponse:
    return SessionCompleteResponse(session_id=session_id)


@router.get("/sessions/{session_id}/report", response_model=SessionReportResponse)
def get_session_report(session_id: UUID) -> SessionReportResponse:
    return SessionReportResponse(
        session_id=session_id,
        metrics={
            "aoi_metrics": [],
            "task_metrics": {},
            "quality": {"score": None, "confidence_band": None},
        },
    )
