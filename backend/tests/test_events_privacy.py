from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_event_ingest_accepts_safe_event() -> None:
    session_id = uuid4()
    payload = {
        "event_type": "gaze",
        "timestamp": "2026-01-01T00:00:00Z",
        "payload": {
            "x": 0.42,
            "y": 0.37,
            "viewport_width": 1920,
            "viewport_height": 1080,
            "confidence": 0.86,
        },
    }
    response = client.post(f"/api/v1/sessions/{session_id}/events", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["accepted_count"] == 1
    assert body["rejected_count"] == 0


def test_event_ingest_rejects_media_like_payload() -> None:
    session_id = uuid4()
    payload = {
        "event_type": "gaze",
        "timestamp": "2026-01-01T00:00:00Z",
        "payload": {
            "x": 0.42,
            "webcam_frame": "<raw-bytes>",
        },
    }
    response = client.post(f"/api/v1/sessions/{session_id}/events", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["accepted_count"] == 0
    assert body["rejected_count"] >= 1


def test_event_ingest_accepts_webgazer_normalized_gaze_event() -> None:
    session_id = uuid4()
    payload = {
        "event_type": "gaze",
        "timestamp": "2026-01-01T00:00:00Z",
        "payload": {
            "source": "webgazer_experimental",
            "tracker_type": "webgazer_experimental",
            "x": 0.52,
            "y": 0.41,
            "viewport_width": 1440,
            "viewport_height": 900,
            "confidence": None,
        },
    }
    response = client.post(f"/api/v1/sessions/{session_id}/events", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["accepted_count"] == 1
    assert body["rejected_count"] == 0


def test_event_ingest_rejects_webgazer_media_like_payload() -> None:
    session_id = uuid4()
    payload = {
        "event_type": "gaze",
        "timestamp": "2026-01-01T00:00:00Z",
        "payload": {
            "source": "webgazer_experimental",
            "tracker_type": "webgazer_experimental",
            "x": 0.52,
            "y": 0.41,
            "image_blob": "not-allowed",
        },
    }
    response = client.post(f"/api/v1/sessions/{session_id}/events", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["accepted_count"] == 0
    assert body["rejected_count"] >= 1
