import json
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def load_synthetic_fixture() -> dict[str, object]:
    fixture_path = Path(__file__).resolve().parents[2] / "contracts" / "fixtures" / "synthetic-event-batch.json"
    return json.loads(fixture_path.read_text())


def test_ingesting_shared_fixture_stores_accepted_events() -> None:
    fixture = load_synthetic_fixture()
    session_id = fixture["session_id"]

    response = client.post(f"/api/v1/sessions/{session_id}/events", json=fixture)

    assert response.status_code == 200
    body = response.json()
    assert body["accepted_count"] == len(fixture["events"])  # type: ignore[arg-type]
    assert body["rejected_count"] == 0
    assert body["stored_count_for_session"] == len(fixture["events"])  # type: ignore[arg-type]
    assert "process-local demo memory" in body["note"]


def test_report_after_ingest_returns_matching_event_count() -> None:
    fixture = load_synthetic_fixture()
    session_id = fixture["session_id"]

    ingest_response = client.post(f"/api/v1/sessions/{session_id}/events", json=fixture)
    assert ingest_response.status_code == 200

    report_response = client.get(f"/api/v1/sessions/{session_id}/report")

    assert report_response.status_code == 200
    report = report_response.json()
    assert report["event_count"] == len(fixture["events"])  # type: ignore[arg-type]
    assert report["event_type_counts"]["gaze"] == 1
    assert report["first_event_timestamp"] == "2026-01-15T17:30:00.000Z"
    assert report["last_event_timestamp"] == "2026-01-15T17:30:22.800Z"
    assert report["contains_gaze_events"] is True
    assert report["low_confidence_sample_rate"] == 0
    assert report["session_quality_score"] > 0
    assert "Backend demo report generated from in-memory synthetic telemetry." in report["insights"]
    assert "No raw webcam media is stored by GazeTrack." in report["insights"]


def test_report_before_ingest_returns_safe_empty_report() -> None:
    session_id = uuid4()

    response = client.get(f"/api/v1/sessions/{session_id}/report")

    assert response.status_code == 200
    body = response.json()
    assert body["event_count"] == 0
    assert body["event_type_counts"] == {}
    assert body["first_event_timestamp"] is None
    assert body["last_event_timestamp"] is None
    assert body["contains_gaze_events"] is False
    assert body["low_confidence_sample_rate"] is None
    assert body["session_quality_score"] is None
    assert "No telemetry events have been ingested for this session yet." in body["insights"]
    assert "No raw webcam media is stored by GazeTrack." in body["insights"]


def test_unsafe_media_like_events_are_rejected_and_not_stored() -> None:
    session_id = uuid4()
    payload = {
        "event_type": "gaze",
        "timestamp": "2026-01-01T00:00:00Z",
        "payload": {"x": 0.42, "confidence": 0.8, "webcam_frame": "<raw-bytes>"},
    }

    ingest_response = client.post(f"/api/v1/sessions/{session_id}/events", json=payload)
    report_response = client.get(f"/api/v1/sessions/{session_id}/report")

    assert ingest_response.status_code == 200
    ingest_body = ingest_response.json()
    assert ingest_body["accepted_count"] == 0
    assert ingest_body["rejected_count"] == 1
    assert ingest_body["stored_count_for_session"] == 0

    assert report_response.status_code == 200
    report = report_response.json()
    assert report["event_count"] == 0
    assert report["contains_gaze_events"] is False


def test_completing_session_marks_completed_and_returns_event_count() -> None:
    fixture = load_synthetic_fixture()
    session_id = fixture["session_id"]
    ingest_response = client.post(f"/api/v1/sessions/{session_id}/events", json=fixture)
    assert ingest_response.status_code == 200

    complete_response = client.post(f"/api/v1/sessions/{session_id}/complete")
    report_response = client.get(f"/api/v1/sessions/{session_id}/report")

    assert complete_response.status_code == 200
    complete_body = complete_response.json()
    assert complete_body["session_id"] == session_id
    assert complete_body["status"] == "completed"
    assert complete_body["event_count"] == len(fixture["events"])  # type: ignore[arg-type]
    assert complete_body["completed"] is True

    assert report_response.status_code == 200
    assert report_response.json()["completed"] is True
