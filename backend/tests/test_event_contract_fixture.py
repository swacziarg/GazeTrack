import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

MEDIA_LIKE_KEY_TOKENS = {"video", "frame", "image", "base64", "blob", "webcam_frame"}


def contains_media_like_fields(value: object) -> bool:
    if isinstance(value, dict):
        return any(
            any(token in str(key).lower() for token in MEDIA_LIKE_KEY_TOKENS) or contains_media_like_fields(nested)
            for key, nested in value.items()
        )
    if isinstance(value, list):
        return any(contains_media_like_fields(item) for item in value)
    return False


def test_synthetic_event_fixture_matches_backend_ingest_contract() -> None:
    fixture_path = Path(__file__).resolve().parents[2] / "contracts" / "fixtures" / "synthetic-event-batch.json"
    fixture = json.loads(fixture_path.read_text())
    event_types = [event["event_type"] for event in fixture["events"]]

    assert event_types[0] == "task_start"
    assert event_types.count("calibration") >= 5
    assert event_types.count("gaze") >= 8
    assert {"scroll", "click", "task_complete"}.issubset(set(event_types))
    assert not contains_media_like_fields(fixture)

    response = client.post(f"/api/v1/sessions/{fixture['session_id']}/events", json=fixture)

    assert response.status_code == 200
    body = response.json()
    assert body["accepted_count"] == len(fixture["events"])
    assert body["rejected_count"] == 0
    assert body["stored_count_for_session"] == len(fixture["events"])
    assert body["rejected_reasons"] == []

    report_response = client.get(f"/api/v1/sessions/{fixture['session_id']}/report")
    assert report_response.status_code == 200
    report = report_response.json()
    assert report["fixation_summary"]["fixation_count"] > 0
    assert report["quality_summary"]["calibration_event_count"] >= 5
