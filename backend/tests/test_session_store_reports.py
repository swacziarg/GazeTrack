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
    assert "local SQLite persistence" in body["note"]


def test_report_after_ingest_returns_matching_event_count() -> None:
    fixture = load_synthetic_fixture()
    session_id = fixture["session_id"]

    ingest_response = client.post(f"/api/v1/sessions/{session_id}/events", json=fixture)
    assert ingest_response.status_code == 200

    report_response = client.get(f"/api/v1/sessions/{session_id}/report")

    assert report_response.status_code == 200
    report = report_response.json()
    assert report["event_count"] == len(fixture["events"])  # type: ignore[arg-type]
    assert report["event_type_counts"]["gaze"] == 8
    assert report["first_event_timestamp"] == "2026-01-15T17:30:00.000Z"
    assert report["last_event_timestamp"] == "2026-01-15T17:30:05.000Z"
    assert report["contains_gaze_events"] is True
    assert report["low_confidence_sample_rate"] == 0
    assert report["session_quality_score"] > 0
    assert report["analytics_version"] == "fixation_demo_v1"
    assert report["tracker_type"] == "synthetic"
    assert report["tracker_experimental"] is False
    assert report["fixation_summary"]["fixation_count"] > 0
    assert report["fixation_summary"]["fixation_algorithm"] == "simple_dispersion_v1"
    assert "Backend demo report generated from persisted SQLite telemetry." in report["insights"]
    assert "No raw webcam media is stored by GazeTrack." in report["insights"]
    assert report["metrics"]["click_count"] == 1
    assert report["metrics"]["scroll_count"] == 1
    assert report["metrics"]["calibration_event_count"] == 6
    assert report["metrics"]["task_event_count"] == 2
    assert report["privacy_summary"]["raw_media_stored"] is False
    assert report["quality_summary"]["calibration_event_count"] == 6
    assert report["quality_summary"]["calibration_points_completed"] == 5
    assert report["quality_summary"]["quality_verdict"] == "pass"
    assert report["replay_summary"]["event_count"] == len(fixture["events"])  # type: ignore[arg-type]
    assert report["replay_summary"]["gaze_event_count"] == 8
    assert report["replay_summary"]["fixation_count"] > 0
    assert report["replay_summary"]["click_count"] == 1
    assert report["replay_summary"]["scroll_count"] == 1
    assert report["replay_summary"]["task_event_count"] == 2
    assert report["replay_summary"]["duration_ms"] == 5000
    assert report["replay_summary"]["coordinate_space"] == "normalized"
    assert report["replay_aoi_overlay"]
    assert report["replay_aoi_overlay"][0]["coordinate_space"] == "normalized"
    assert report["replay_events"][0]["type"] == "task_start"
    assert report["replay_events"][0]["relative_ms"] == 0
    assert [event["relative_ms"] for event in report["replay_events"]] == sorted(
        event["relative_ms"] for event in report["replay_events"]
    )
    gaze_event = next(event for event in report["replay_events"] if event["type"] == "gaze")
    assert gaze_event["x"] == 0.608
    assert gaze_event["y"] == 0.432
    assert gaze_event["confidence"] == 0.9
    assert gaze_event["aoi_ids"]
    assert report["replay_fixations"]
    assert report["replay_fixations"][0]["type"] == "fixation"
    assert report["replay_fixations"][0]["duration_ms"] > 0
    assert report["replay_fixations"][0]["sample_count"] >= 3


def test_report_identifies_experimental_webgazer_tracker() -> None:
    session_id = uuid4()
    payload = {
        "events": [
            {
                "event_type": "task_start",
                "timestamp": "2026-01-15T17:30:00.000Z",
                "payload": {
                    "source": "webgazer_experimental",
                    "tracker_type": "webgazer_experimental",
                    "target": "Find checkout.",
                },
            },
            {
                "event_type": "calibration",
                "timestamp": "2026-01-15T17:30:01.000Z",
                "payload": {
                    "source": "webgazer_experimental",
                    "tracker_type": "webgazer_experimental",
                    "calibration_points_completed": 5,
                    "calibration_quality": "weak",
                    "quality_warning": "Calibration quality is weak.",
                },
            },
            {
                "event_type": "gaze",
                "timestamp": "2026-01-15T17:30:02.000Z",
                "payload": {
                    "source": "webgazer_experimental",
                    "tracker_type": "webgazer_experimental",
                    "x": 0.52,
                    "y": 0.41,
                    "viewport_width": 1440,
                    "viewport_height": 900,
                    "confidence": 0.62,
                },
            },
        ]
    }

    ingest_response = client.post(f"/api/v1/sessions/{session_id}/events", json=payload)
    report_response = client.get(f"/api/v1/sessions/{session_id}/report")

    assert ingest_response.status_code == 200
    assert report_response.status_code == 200
    report = report_response.json()
    assert report["tracker_type"] == "webgazer_experimental"
    assert report["tracker_mode_label"] == "Experimental browser gaze"
    assert report["tracker_experimental"] is True
    assert "not medical-grade" in report["tracker_notice"]
    assert report["privacy_summary"]["tracker_type"] == "webgazer_experimental"
    assert any("not medical-grade" in insight for insight in report["insights"])


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
    assert body["fixation_summary"]["fixation_count"] == 0
    assert body["quality_summary"]["quality_verdict"] == "fail"
    assert body["replay_summary"]["event_count"] == 0
    assert body["replay_summary"]["duration_ms"] == 0
    assert body["replay_events"] == []
    assert body["replay_fixations"] == []
    assert body["replay_aoi_overlay"]
    assert "No telemetry events have been ingested for this session yet." in body["insights"]
    assert "No raw webcam media is stored by GazeTrack." in body["insights"]


def test_report_replay_events_exclude_raw_payloads_and_media_like_fields() -> None:
    fixture = load_synthetic_fixture()
    session_id = fixture["session_id"]

    ingest_response = client.post(f"/api/v1/sessions/{session_id}/events", json=fixture)
    assert ingest_response.status_code == 200

    report_response = client.get(f"/api/v1/sessions/{session_id}/report")

    assert report_response.status_code == 200
    report = report_response.json()
    replay_json = json.dumps(
        {
            "events": report["replay_events"],
            "fixations": report["replay_fixations"],
            "aoi_overlay": report["replay_aoi_overlay"],
        }
    ).lower()
    forbidden_fragments = ["payload", "video", "frame", "image", "base64", "blob", "webcam_frame"]
    for fragment in forbidden_fragments:
        assert fragment not in replay_json


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
