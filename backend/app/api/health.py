from fastapi import APIRouter

from app.models.api import APIStatus

router = APIRouter(tags=["health"])


@router.get("/health", response_model=APIStatus)
def health() -> APIStatus:
    return APIStatus()
