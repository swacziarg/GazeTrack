from uuid import UUID

from fastapi import APIRouter, HTTPException

from app.models.api import (
    AoiCreateRequest,
    AoiResponse,
    StudyConfigurationRequest,
    StudyConfigurationResponse,
    StudyCreateRequest,
    StudyResponse,
    TaskCreateRequest,
    TaskResponse,
)
from app.repository import AoiRecord, StudyRecord, TaskRecord, get_repository

router = APIRouter(prefix="/studies", tags=["studies"])


def _study_response(record: StudyRecord) -> StudyResponse:
    return StudyResponse(
        study_id=record.id,
        name=record.title,
        objective=record.description,
        target_url=record.target_url,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def _task_response(record: TaskRecord) -> TaskResponse:
    return TaskResponse(
        task_id=record.id,
        study_id=record.study_id,
        title=record.title,
        prompt=record.prompt,
        success_criteria=record.success_criteria,
        target_url=record.target_url,
        created_at=record.created_at,
    )


def _aoi_response(record: AoiRecord) -> AoiResponse:
    return AoiResponse(
        aoi_id=record.id,
        study_id=record.study_id,
        label=record.label,
        semantic_type=record.semantic_type,
        page_url=record.page_url,
        x=record.x,
        y=record.y,
        width=record.width,
        height=record.height,
        coordinate_space=record.coordinate_space,
        created_at=record.created_at,
    )


@router.post("", response_model=StudyResponse)
def create_study(payload: StudyCreateRequest) -> StudyResponse:
    record = get_repository().create_study(
        title=payload.name,
        description=payload.objective,
        target_url=payload.target_url,
    )
    return _study_response(record)


def _configuration_response(
    study: StudyRecord,
    tasks: list[TaskRecord],
    aois: list[AoiRecord],
) -> StudyConfigurationResponse:
    return StudyConfigurationResponse(
        study=_study_response(study),
        tasks=[_task_response(record) for record in tasks],
        aois=[_aoi_response(record) for record in aois],
    )


@router.post("/configurations", response_model=StudyConfigurationResponse)
def create_study_configuration(payload: StudyConfigurationRequest) -> StudyConfigurationResponse:
    repository = get_repository()
    study = repository.create_study(
        title=payload.name,
        description=payload.objective,
        target_url=payload.target_url,
    )
    study, tasks, aois = repository.replace_study_configuration(
        study_id=study.id,
        title=payload.name,
        description=payload.objective,
        target_url=payload.target_url,
        tasks=[task.model_dump() for task in payload.tasks],
        aois=[aoi.model_dump() for aoi in payload.aois],
    )
    return _configuration_response(study, tasks, aois)


@router.get("", response_model=list[StudyResponse])
def list_studies() -> list[StudyResponse]:
    repository = get_repository()
    repository.ensure_default_study()
    return [_study_response(record) for record in repository.list_studies()]


@router.get("/{study_id}", response_model=StudyResponse)
def get_study(study_id: UUID) -> StudyResponse:
    record = get_repository().get_study(study_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Study not found")
    return _study_response(record)


@router.put("/{study_id}/configuration", response_model=StudyConfigurationResponse)
def replace_study_configuration(study_id: UUID, payload: StudyConfigurationRequest) -> StudyConfigurationResponse:
    repository = get_repository()
    if repository.get_study(study_id) is None:
        raise HTTPException(status_code=404, detail="Study not found")
    study, tasks, aois = repository.replace_study_configuration(
        study_id=study_id,
        title=payload.name,
        description=payload.objective,
        target_url=payload.target_url,
        tasks=[task.model_dump() for task in payload.tasks],
        aois=[aoi.model_dump() for aoi in payload.aois],
    )
    return _configuration_response(study, tasks, aois)


@router.post("/{study_id}/tasks", response_model=TaskResponse)
def create_task(study_id: UUID, payload: TaskCreateRequest) -> TaskResponse:
    repository = get_repository()
    if repository.get_study(study_id) is None:
        raise HTTPException(status_code=404, detail="Study not found")
    record = repository.create_task(
        study_id=study_id,
        title=payload.title,
        prompt=payload.prompt,
        success_criteria=payload.success_criteria,
        target_url=payload.target_url,
    )
    return _task_response(record)


@router.get("/{study_id}/tasks", response_model=list[TaskResponse])
def list_tasks_for_study(study_id: UUID) -> list[TaskResponse]:
    repository = get_repository()
    if repository.get_study(study_id) is None:
        raise HTTPException(status_code=404, detail="Study not found")
    return [_task_response(record) for record in repository.list_tasks_for_study(study_id)]


@router.post("/{study_id}/aois", response_model=AoiResponse)
def create_aoi(study_id: UUID, payload: AoiCreateRequest) -> AoiResponse:
    repository = get_repository()
    if repository.get_study(study_id) is None:
        raise HTTPException(status_code=404, detail="Study not found")
    record = repository.create_aoi(
        study_id=study_id,
        label=payload.label,
        semantic_type=payload.semantic_type,
        page_url=payload.page_url,
        x=payload.x,
        y=payload.y,
        width=payload.width,
        height=payload.height,
        coordinate_space=payload.coordinate_space,
    )
    return _aoi_response(record)


@router.get("/{study_id}/aois", response_model=list[AoiResponse])
def list_aois_for_study(study_id: UUID) -> list[AoiResponse]:
    repository = get_repository()
    if repository.get_study(study_id) is None:
        raise HTTPException(status_code=404, detail="Study not found")
    return [_aoi_response(record) for record in repository.list_aois_for_study(study_id)]
