import json
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.db import connect_database, initialize_database
from app.main import app
from app.models.api import EventEnvelope
from app.repository import GazeTrackRepository

client = TestClient(app)


def load_synthetic_fixture() -> dict[str, object]:
    fixture_path = Path(__file__).resolve().parents[2] / "contracts" / "fixtures" / "synthetic-event-batch.json"
    return json.loads(fixture_path.read_text())


def test_database_initialization_creates_core_tables() -> None:
    initialize_database()

    with connect_database() as connection:
        rows = connection.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name IN ('studies', 'tasks', 'aois', 'sessions', 'telemetry_events', 'reports')
            """
        ).fetchall()

    assert {row["name"] for row in rows} == {"studies", "tasks", "aois", "sessions", "telemetry_events", "reports"}


def test_repository_creates_study_and_session() -> None:
    repository = GazeTrackRepository()
    study = repository.create_study(title="Checkout study", description="Find the checkout CTA")
    session = repository.create_session(study.id)

    assert repository.get_study(study.id) == study
    assert session.study_id == study.id
    assert session.status == "started"


def test_api_creates_lists_studies_and_creates_session() -> None:
    create_response = client.post(
        "/api/v1/studies",
        json={"name": "Pricing page study", "objective": "Find the team plan", "target_url": "https://example.test"},
    )
    assert create_response.status_code == 200
    study = create_response.json()

    list_response = client.get("/api/v1/studies")
    session_response = client.post(f"/api/v1/studies/{study['study_id']}/sessions", json={})

    assert list_response.status_code == 200
    assert any(item["study_id"] == study["study_id"] for item in list_response.json())
    assert session_response.status_code == 200
    assert session_response.json()["study_id"] == study["study_id"]
    assert session_response.json()["persistence"] == "sqlite"


def test_persisted_events_survive_repository_reinstantiation() -> None:
    session_id = uuid4()
    event = EventEnvelope(
        event_type="gaze",
        timestamp="2026-01-01T00:00:00Z",
        payload={"x": 100, "y": 200, "confidence": 0.91},
    )

    first_repository = GazeTrackRepository()
    first_repository.append_accepted_events(session_id, [event])

    second_repository = GazeTrackRepository()
    events = second_repository.get_accepted_events(session_id)

    assert len(events) == 1
    assert events[0].payload["confidence"] == 0.91


def test_report_generation_uses_persisted_events_and_saves_report() -> None:
    fixture = load_synthetic_fixture()
    session_id = fixture["session_id"]

    ingest_response = client.post(f"/api/v1/sessions/{session_id}/events", json=fixture)
    report_response = client.get(f"/api/v1/sessions/{session_id}/report")

    assert ingest_response.status_code == 200
    assert report_response.status_code == 200
    assert report_response.json()["event_count"] == len(fixture["events"])  # type: ignore[arg-type]

    with connect_database() as connection:
        row = connection.execute("SELECT COUNT(*) AS count FROM reports WHERE session_id = ?", (session_id,)).fetchone()

    assert row["count"] == 1


def test_privacy_unsafe_payloads_are_not_persisted() -> None:
    session_id = uuid4()
    payload = {
        "event_type": "gaze",
        "timestamp": "2026-01-01T00:00:00Z",
        "payload": {"x": 0.42, "webcam_frame": "<raw-bytes>"},
    }

    response = client.post(f"/api/v1/sessions/{session_id}/events", json=payload)

    assert response.status_code == 200
    assert response.json()["rejected_count"] == 1
    assert GazeTrackRepository().count_accepted_events(session_id) == 0
