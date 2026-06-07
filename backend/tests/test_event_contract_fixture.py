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

    assert [event["event_type"] for event in fixture["events"]] == [
        "task_start",
        "calibration",
        "gaze",
        "scroll",
        "click",
        "task_complete",
    ]
    assert not contains_media_like_fields(fixture)

    response = client.post(f"/api/v1/sessions/{fixture['session_id']}/events", json=fixture)

    assert response.status_code == 200
    body = response.json()
    assert body["accepted_count"] == len(fixture["events"])
    assert body["rejected_count"] == 0
    assert body["stored_count_for_session"] == len(fixture["events"])
    assert body["rejected_reasons"] == []
