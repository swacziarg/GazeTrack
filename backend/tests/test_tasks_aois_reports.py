from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.models.api import EventEnvelope
from app.repository import DEMO_STUDY_ID, GazeTrackRepository
from app.services.aoi_metrics import compute_aoi_metrics, is_point_inside_aoi, normalize_event_point

client = TestClient(app)


def create_study() -> dict[str, object]:
    response = client.post("/api/v1/studies", json={"name": "Task AOI study", "objective": "Measure CTA attention"})
    assert response.status_code == 200
    return response.json()


def test_api_creates_and_lists_tasks() -> None:
    study = create_study()
    response = client.post(
        f"/api/v1/studies/{study['study_id']}/tasks",
        json={
            "title": "Find checkout",
            "prompt": "Find the checkout button.",
            "success_criteria": "Checkout CTA clicked.",
            "target_url": "https://example.test/pricing",
        },
    )
    list_response = client.get(f"/api/v1/studies/{study['study_id']}/tasks")

    assert response.status_code == 200
    assert response.json()["title"] == "Find checkout"
    assert list_response.status_code == 200
    assert [task["title"] for task in list_response.json()] == ["Find checkout"]


def test_api_creates_and_lists_aois() -> None:
    study = create_study()
    response = client.post(
        f"/api/v1/studies/{study['study_id']}/aois",
        json={
            "label": "Primary CTA",
            "semantic_type": "CTA",
            "page_url": "https://example.test/pricing",
            "x": 0.5,
            "y": 0.3,
            "width": 0.2,
            "height": 0.1,
        },
    )
    list_response = client.get(f"/api/v1/studies/{study['study_id']}/aois")

    assert response.status_code == 200
    assert response.json()["coordinate_space"] == "normalized"
    assert response.json()["semantic_type"] == "CTA"
    assert list_response.status_code == 200
    assert [aoi["label"] for aoi in list_response.json()] == ["Primary CTA"]


def test_api_creates_and_replaces_study_configuration() -> None:
    create_response = client.post(
        "/api/v1/studies/configurations",
        json={
            "name": "Checkout builder study",
            "objective": "Measure checkout CTA discovery.",
            "target_url": "https://example.test/checkout",
            "tasks": [{"prompt": "Find checkout."}],
            "aois": [
                {
                    "label": "Checkout CTA",
                    "semantic_type": "CTA",
                    "x": 0.5,
                    "y": 0.4,
                    "width": 0.2,
                    "height": 0.1,
                },
                {
                    "label": "Plan cards",
                    "semantic_type": "pricing",
                    "x": 0.2,
                    "y": 0.6,
                    "width": 0.4,
                    "height": 0.2,
                },
            ],
        },
    )

    assert create_response.status_code == 200
    created = create_response.json()
    study_id = created["study"]["study_id"]
    assert created["study"]["target_url"] == "https://example.test/checkout"
    assert [task["prompt"] for task in created["tasks"]] == ["Find checkout."]
    assert [aoi["label"] for aoi in created["aois"]] == ["Checkout CTA", "Plan cards"]

    replace_response = client.put(
        f"/api/v1/studies/{study_id}/configuration",
        json={
            "name": "Checkout builder study updated",
            "objective": "Measure form attention.",
            "target_url": "https://example.test/signup",
            "tasks": [{"prompt": "Find the signup form."}],
            "aois": [
                {
                    "label": "Signup form",
                    "semantic_type": "form",
                    "x": 0.35,
                    "y": 0.35,
                    "width": 0.3,
                    "height": 0.3,
                }
            ],
        },
    )

    assert replace_response.status_code == 200
    replaced = replace_response.json()
    assert replaced["study"]["name"] == "Checkout builder study updated"
    assert [task["prompt"] for task in replaced["tasks"]] == ["Find the signup form."]
    assert [aoi["label"] for aoi in replaced["aois"]] == ["Signup form"]


def test_default_demo_study_creates_demo_tasks_and_aois() -> None:
    repository = GazeTrackRepository()
    study = repository.ensure_default_study()

    assert study.id == DEMO_STUDY_ID
    assert [task.title for task in repository.list_tasks_for_study(study.id)] == ["Find the main call to action"]
    assert {aoi.label for aoi in repository.list_aois_for_study(study.id)} == {
        "Hero headline",
        "Primary CTA",
        "Navigation",
        "Pricing preview",
        "Footer",
    }


def test_aoi_hit_testing_and_event_point_normalization() -> None:
    repository = GazeTrackRepository()
    study = repository.create_study(title="Hit test study")
    aoi = repository.create_aoi(study_id=study.id, label="Hero CTA", x=0.5, y=0.4, width=0.2, height=0.1)

    assert normalize_event_point({"x": 720, "y": 450, "viewport_width": 1440, "viewport_height": 900}) == (0.5, 0.5)
    assert is_point_inside_aoi(0.55, 0.45, aoi) is True
    assert is_point_inside_aoi(0.9, 0.45, aoi) is False


def test_report_generation_includes_aoi_metrics_for_gaze_and_clicks() -> None:
    repository = GazeTrackRepository()
    study = repository.create_study(title="AOI report study")
    task = repository.create_task(study_id=study.id, title="Find CTA", prompt="Click the CTA.")
    aoi = repository.create_aoi(study_id=study.id, label="Primary CTA", x=0.5, y=0.4, width=0.2, height=0.1)
    session = repository.create_session(study.id)
    repository.append_accepted_events(
        session.id,
        [
            EventEnvelope(
                event_type="gaze",
                timestamp="2026-01-01T00:00:00.000Z",
                payload={"x": 0.55, "y": 0.45, "confidence": 0.9},
            ),
            EventEnvelope(
                event_type="gaze",
                timestamp="2026-01-01T00:00:00.150Z",
                payload={"point": {"x": 0.555, "y": 0.455}, "confidence": 0.91},
            ),
            EventEnvelope(
                event_type="gaze",
                timestamp="2026-01-01T00:00:00.300Z",
                payload={"point": {"x": 0.56, "y": 0.46}, "confidence": 0.92},
            ),
            EventEnvelope(
                event_type="click",
                timestamp="2026-01-01T00:00:01.000Z",
                payload={"x": 792, "y": 405, "viewport_width": 1440, "viewport_height": 900},
            ),
        ],
    )

    response = client.get(f"/api/v1/sessions/{session.id}/report")

    assert response.status_code == 200
    report = response.json()
    assert report["task_count"] == 1
    assert report["study_name"] == "AOI report study"
    assert report["task_prompts"] == ["Click the CTA."]
    assert report["aoi_count"] == 1
    assert report["has_aoi_metrics"] is True
    assert report["aoi_metrics"] == [
        {
            "aoi_id": str(aoi.id),
            "label": "Primary CTA",
            "page_url": None,
            "coordinate_space": "normalized",
            "gaze_sample_count": 3,
            "first_gaze_timestamp": "2026-01-01T00:00:00.000Z",
            "approximate_dwell_ms": 300,
            "click_count_inside_aoi": 1,
            "fixation_count": 1,
            "fixation_dwell_ms": 300,
            "first_fixation_timestamp": "2026-01-01T00:00:00.000Z",
            "time_to_first_fixation_ms": None,
            "average_fixation_confidence": 0.91,
        }
    ]
    assert report["analytics_version"] == "fixation_demo_v1"
    assert report["fixation_summary"]["fixation_count"] == 1
    assert report["metrics"]["task_count"] == 1
    assert report["metrics"]["aoi_count"] == 1
    assert report["metrics"]["fixation_summary"]["total_fixation_dwell_ms"] == 300
    assert task.title == "Find CTA"


def test_compute_aoi_metrics_uses_fallback_dwell_when_timestamps_are_missing() -> None:
    repository = GazeTrackRepository()
    study = repository.create_study(title="Fallback dwell study")
    aoi = repository.create_aoi(study_id=study.id, label="Primary CTA", x=0.5, y=0.4, width=0.2, height=0.1)

    metrics = compute_aoi_metrics(
        [aoi],
        [
            EventEnvelope(event_type="gaze", timestamp="not-a-date", payload={"x": 0.55, "y": 0.45}),
            EventEnvelope(event_type="gaze", timestamp="also-not-a-date", payload={"x": 0.56, "y": 0.46}),
        ],
    )

    assert metrics[0].gaze_sample_count == 2
    assert metrics[0].approximate_dwell_ms == 200
    assert metrics[0].fixation_count == 0
    assert metrics[0].fixation_dwell_ms == 0


def test_reports_still_work_when_study_has_no_aois() -> None:
    repository = GazeTrackRepository()
    study = repository.create_study(title="No AOI study")
    session = repository.create_session(study.id)
    repository.append_accepted_events(
        session.id,
        [
            EventEnvelope(
                event_type="gaze",
                timestamp="2026-01-01T00:00:00.000Z",
                payload={"x": 0.55, "y": 0.45, "confidence": 0.9},
            )
        ],
    )

    response = client.get(f"/api/v1/sessions/{session.id}/report")

    assert response.status_code == 200
    report = response.json()
    assert report["event_count"] == 1
    assert report["aoi_count"] == 0
    assert report["has_aoi_metrics"] is False
    assert report["aoi_metrics"] == []


def test_aoi_endpoints_return_404_for_unknown_study() -> None:
    study_id = uuid4()

    assert client.get(f"/api/v1/studies/{study_id}/tasks").status_code == 404
    assert client.get(f"/api/v1/studies/{study_id}/aois").status_code == 404
