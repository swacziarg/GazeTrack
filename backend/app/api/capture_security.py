from uuid import UUID

from fastapi import HTTPException

from app.models.api import normalize_allowed_origin
from app.repository import get_repository


def origin_is_allowed(origin: str | None, allowed_origins: list[str]) -> bool:
    if not allowed_origins:
        return True
    if not origin:
        return False
    try:
        normalized_origin = normalize_allowed_origin(origin)
    except ValueError:
        return False
    return normalized_origin in allowed_origins


def ensure_capture_origin_allowed(study_id: UUID, origin: str | None) -> None:
    study = get_repository().get_study(study_id)
    if study is None:
        raise HTTPException(status_code=404, detail="Study not found")
    if not origin_is_allowed(origin, study.allowed_origins):
        raise HTTPException(status_code=403, detail="Capture origin is not allowed for this study")
