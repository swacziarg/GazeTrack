from fastapi import APIRouter

from app.models.api import MetaResponse

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("", response_model=MetaResponse)
def get_meta() -> MetaResponse:
    return MetaResponse(
        implemented_capabilities=[
            "health",
            "meta",
            "sqlite_study_persistence",
            "sqlite_session_persistence",
            "event_ingest_validation",
            "persisted_demo_reports",
        ]
    )
