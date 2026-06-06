from uuid import UUID

from fastapi import APIRouter

from app.models.api import StudyCreateRequest, StudyFactory, StudyResponse

router = APIRouter(prefix="/studies", tags=["studies"])


@router.post("", response_model=StudyResponse)
def create_study(payload: StudyCreateRequest) -> StudyResponse:
    return StudyFactory.create_from_request(payload)


@router.get("/{study_id}", response_model=StudyResponse)
def get_study(study_id: UUID) -> StudyResponse:
    return StudyResponse(
        study_id=study_id,
        name="placeholder-study",
        objective="Persistence not implemented; this is a generated placeholder response.",
        target_url=None,
    )
