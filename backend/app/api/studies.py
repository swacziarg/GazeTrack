from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from app.models.api import (
    AoiCreateRequest,
    AoiResponse,
    CaptureConfigAoiResponse,
    CaptureConfigResponse,
    CaptureSessionCreateRequest,
    CaptureSnippetConfigResponse,
    InstallVerificationResponse,
    SessionResponse,
    StudyConfigurationRequest,
    StudyConfigurationResponse,
    StudyCreateRequest,
    StudyResponse,
    TaskCreateRequest,
    TaskResponse,
)
from app.repository import AoiRecord, StudyRecord, TaskRecord, get_repository

router = APIRouter(prefix="/studies", tags=["studies"])
VERSIONED_CAPTURE_SDK_PATH = "/sdk/v0.2/gazetrack-capture.js"


def _study_response(record: StudyRecord) -> StudyResponse:
    return StudyResponse(
        study_id=record.id,
        name=record.title,
        objective=record.description,
        target_url=record.target_url,
        allowed_origins=record.allowed_origins,
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
        role_key=record.role_key,
        selector=record.selector,
        required=record.required,
        page_url=record.page_url,
        x=record.x,
        y=record.y,
        width=record.width,
        height=record.height,
        coordinate_space=record.coordinate_space,
        created_at=record.created_at,
    )


def _role_key(record: AoiRecord) -> str:
    if record.role_key:
        return record.role_key
    semantic_type = (record.semantic_type or record.label).strip().lower()
    return semantic_type.replace(" ", "_").replace("-", "_")


@router.post("", response_model=StudyResponse)
def create_study(payload: StudyCreateRequest) -> StudyResponse:
    record = get_repository().create_study(
        title=payload.name,
        description=payload.objective,
        target_url=payload.target_url,
        allowed_origins=payload.allowed_origins,
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
        allowed_origins=payload.allowed_origins,
    )
    study, tasks, aois = repository.replace_study_configuration(
        study_id=study.id,
        title=payload.name,
        description=payload.objective,
        target_url=payload.target_url,
        allowed_origins=payload.allowed_origins,
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
        allowed_origins=payload.allowed_origins,
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
        role_key=payload.role_key,
        selector=payload.selector,
        required=payload.required,
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


def _capture_config_response(
    study: StudyRecord,
    tasks: list[TaskRecord],
    aois: list[AoiRecord],
) -> CaptureConfigResponse:
    return CaptureConfigResponse(
        study_id=study.id,
        name=study.title,
        objective=study.description,
        target_url=study.target_url,
        task_prompt=tasks[0].prompt if tasks else "Complete the website task.",
        aois=[
            CaptureConfigAoiResponse(
                aoi_id=aoi.id,
                label=aoi.label,
                semantic_type=aoi.semantic_type,
                role_key=_role_key(aoi),
                selector=aoi.selector,
                required=aoi.required,
            )
            for aoi in aois
        ],
    )


def _capture_config_inputs(study_id: UUID) -> tuple[StudyRecord, list[TaskRecord], list[AoiRecord]]:
    repository = get_repository()
    study = repository.get_study(study_id)
    if study is None:
        raise HTTPException(status_code=404, detail="Study not found")
    tasks = repository.list_tasks_for_study(study_id)
    aois = repository.list_aois_for_study(study_id)
    if not aois:
        repository.ensure_default_study_content(study_id)
        aois = repository.list_aois_for_study(study_id)
    return study, tasks, aois


@router.get("/{study_id}/capture-config", response_model=CaptureConfigResponse)
def get_capture_config(study_id: UUID) -> CaptureConfigResponse:
    study, tasks, aois = _capture_config_inputs(study_id)
    return _capture_config_response(study, tasks, aois)


@router.get("/{study_id}/capture-snippet-config", response_model=CaptureSnippetConfigResponse)
def get_capture_snippet_config(study_id: UUID) -> CaptureSnippetConfigResponse:
    repository = get_repository()
    capture_token = repository.ensure_capture_token(study_id)
    if capture_token is None:
        raise HTTPException(status_code=404, detail="Study not found")
    study, tasks, aois = _capture_config_inputs(study_id)
    config = _capture_config_response(study, tasks, aois)
    return CaptureSnippetConfigResponse(**config.model_dump(), capture_token=capture_token)


def _recommended_capture_snippet(api_base_url: str, study_id: UUID, capture_token: str) -> str:
    return f"""<script>
  window.GazeTrackConfig = {{
    apiBaseUrl: "{api_base_url}",
    studyId: "{study_id}",
    captureToken: "{capture_token}"
  }}
</script>
<script src="{api_base_url}{VERSIONED_CAPTURE_SDK_PATH}" async></script>"""


@router.get("/{study_id}/install-verification", response_model=InstallVerificationResponse)
def get_install_verification(study_id: UUID, request: Request) -> InstallVerificationResponse:
    repository = get_repository()
    capture_token = repository.ensure_capture_token(study_id)
    if capture_token is None:
        raise HTTPException(status_code=404, detail="Study not found")

    study, tasks, aois = _capture_config_inputs(study_id)
    config = _capture_config_response(study, tasks, aois)
    api_base_url = str(request.base_url).rstrip("/")
    return InstallVerificationResponse(
        study_id=study.id,
        expected_script_path=VERSIONED_CAPTURE_SDK_PATH,
        expected_script_url=f"{api_base_url}{VERSIONED_CAPTURE_SDK_PATH}",
        capture_token_exists=bool(capture_token),
        target_url=study.target_url,
        allowed_origins=study.allowed_origins,
        aois=config.aois,
        recommended_snippet=_recommended_capture_snippet(api_base_url, study.id, capture_token),
    )


@router.post("/{study_id}/capture-token/rotate", response_model=CaptureSnippetConfigResponse)
def rotate_capture_token(study_id: UUID) -> CaptureSnippetConfigResponse:
    repository = get_repository()
    capture_token = repository.rotate_capture_token(study_id)
    if capture_token is None:
        raise HTTPException(status_code=404, detail="Study not found")
    study, tasks, aois = _capture_config_inputs(study_id)
    config = _capture_config_response(study, tasks, aois)
    return CaptureSnippetConfigResponse(**config.model_dump(), capture_token=capture_token)


@router.post("/{study_id}/capture-sessions", response_model=SessionResponse)
def create_capture_session(study_id: UUID, payload: CaptureSessionCreateRequest) -> SessionResponse:
    repository = get_repository()
    if repository.get_study(study_id) is None:
        raise HTTPException(status_code=404, detail="Study not found")
    if not repository.capture_token_matches(study_id, payload.capture_token):
        raise HTTPException(status_code=403, detail="Invalid capture token")
    record = repository.create_session(study_id)
    return SessionResponse(session_id=record.id, study_id=record.study_id, status="started")
