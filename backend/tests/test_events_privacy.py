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
        "events": [
            {
                "event_type": "task_start",
                "timestamp": "2026-01-01T00:00:00Z",
                "payload": {
                    "source": "webgazer_experimental",
                    "tracker_type": "webgazer_experimental",
                    "target": "Find the CTA.",
                },
            },
            {
                "event_type": "gaze",
                "timestamp": "2026-01-01T00:00:01Z",
                "payload": {
                    "source": "webgazer_experimental",
                    "tracker_type": "webgazer_experimental",
                    "x": 0.52,
                    "y": 0.41,
                    "viewport_width": 1440,
                    "viewport_height": 900,
                    "confidence": None,
                },
            },
        ],
    }
    response = client.post(f"/api/v1/sessions/{session_id}/events", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["accepted_count"] == 2
    assert body["rejected_count"] == 0


def test_event_ingest_rejects_webgazer_gaze_without_task_context() -> None:
    session_id = uuid4()
    payload = {
        "event_type": "gaze",
        "timestamp": "2026-01-01T00:00:00Z",
        "payload": {
            "source": "webgazer_experimental",
            "tracker_type": "webgazer_experimental",
            "x": 0.52,
            "y": 0.41,
        },
    }
    response = client.post(f"/api/v1/sessions/{session_id}/events", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["accepted_count"] == 0
    assert body["rejected_count"] == 1
    assert body["rejected_reasons"] == [
        "Rejected WebGazer event_type=gaze without accepted task_start context."
    ]


def test_event_ingest_rejects_bad_coordinates_and_confidence() -> None:
    session_id = uuid4()
    payload = {
        "events": [
            {
                "event_type": "gaze",
                "timestamp": "2026-01-01T00:00:00Z",
                "payload": {"x": 1.4, "y": 0.41, "confidence": 0.8},
            },
            {
                "event_type": "gaze",
                "timestamp": "2026-01-01T00:00:01Z",
                "payload": {"x": 0.52, "y": 0.41, "confidence": 2},
            },
        ],
    }
    response = client.post(f"/api/v1/sessions/{session_id}/events", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["accepted_count"] == 0
    assert body["rejected_count"] == 2
    assert body["stored_count_for_session"] == 0


def test_event_ingest_sanitizes_unknown_payload_fields_before_storage() -> None:
    session_id = uuid4()
    payload = {
        "event_type": "gaze",
        "timestamp": "2026-01-01T00:00:00Z",
        "payload": {
            "label": "Safe gaze",
            "x": 0.52,
            "y": 0.41,
            "confidence": 0.8,
            "random_debug_dump": {"not": "stored"},
        },
    }
    response = client.post(f"/api/v1/sessions/{session_id}/events", json=payload)

    assert response.status_code == 200
    assert response.json()["accepted_count"] == 1

    from app.repository import GazeTrackRepository

    events = GazeTrackRepository().get_accepted_events(session_id)
    assert events[0].payload == {
        "label": "Safe gaze",
        "x": 0.52,
        "y": 0.41,
        "confidence": 0.8,
    }


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


def test_event_ingest_accepts_quality_metadata_without_media_payloads() -> None:
    session_id = uuid4()
    payload = {
        "events": [
            {
                "event_type": "task_start",
                "timestamp": "2026-01-01T00:00:00Z",
                "payload": {
                    "source": "webgazer_experimental",
                    "tracker_type": "webgazer_experimental",
                    "target": "Find the CTA.",
                },
            },
            {
                "event_type": "calibration",
                "timestamp": "2026-01-01T00:00:01Z",
                "payload": {
                    "source": "webgazer_experimental",
                    "tracker_type": "webgazer_experimental",
                    "calibration_points_completed": 9,
                    "camera_readiness_score": 92,
                    "camera_readiness_baseline": {
                        "captured_at": "2026-01-01T00:00:01Z",
                        "face_center": {"x": 0.5, "y": 0.5},
                        "face_size": None,
                        "brightness": 0.42,
                        "contrast": 0.16,
                        "observed_fps": 18,
                        "readiness_score": 92,
                    },
                },
            },
            {
                "event_type": "gaze",
                "timestamp": "2026-01-01T00:00:02Z",
                "payload": {
                    "source": "webgazer_experimental",
                    "tracker_type": "webgazer_experimental",
                    "x": 0.52,
                    "y": 0.41,
                    "quality_score": 57,
                    "quality_flags": ["face_center_drift", "low_light"],
                    "tracking_quality": "medium",
                    "drift_metrics": {
                        "face_center_drift": 0.2,
                        "face_size_drift": None,
                        "head_pose_drift": None,
                        "eye_visibility_lost": False,
                        "face_lost": False,
                        "low_light": True,
                        "sample_rate_low": False,
                        "calibration_baseline_age_ms": 1000,
                        "overall_tracking_quality": "medium",
                    },
                },
            },
        ],
    }
    response = client.post(f"/api/v1/sessions/{session_id}/events", json=payload)

    assert response.status_code == 200
    assert response.json()["accepted_count"] == 3

    from app.repository import GazeTrackRepository

    events = GazeTrackRepository().get_accepted_events(session_id)
    gaze_payload = events[-1].payload
    assert gaze_payload["quality_flags"] == ["face_center_drift", "low_light"]
    assert gaze_payload["drift_metrics"]["low_light"] is True
    assert "webcam_frame" not in str(gaze_payload)
