from fastapi import APIRouter

from app.models.api import MetaResponse

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("", response_model=MetaResponse)
def get_meta() -> MetaResponse:
    return MetaResponse(
        implemented_capabilities=[
            "health",
            "meta",
            "study_placeholders",
            "session_placeholders",
            "event_ingest_validation",
            "placeholder_reports",
        ]
    )
