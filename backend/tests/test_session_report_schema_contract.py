import json
from pathlib import Path

from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker

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


def test_backend_generated_session_report_matches_shared_json_schema() -> None:
    repository_root = Path(__file__).resolve().parents[2]
    fixture = json.loads((repository_root / "contracts" / "fixtures" / "synthetic-event-batch.json").read_text())
    schema = json.loads((repository_root / "contracts" / "session-report.schema.json").read_text())

    ingest_response = client.post(f"/api/v1/sessions/{fixture['session_id']}/events", json=fixture)
    assert ingest_response.status_code == 200
    assert ingest_response.json()["rejected_count"] == 0

    report_response = client.get(f"/api/v1/sessions/{fixture['session_id']}/report")
    assert report_response.status_code == 200
    report = report_response.json()

    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    validation_errors = sorted(validator.iter_errors(report), key=lambda error: list(error.path))

    assert validation_errors == [], "\n".join(
        f"{'/'.join(str(part) for part in error.path) or '<root>'}: {error.message}"
        for error in validation_errors
    )
    assert report["privacy_summary"]["raw_media_stored"] is False
    assert not contains_media_like_fields(report)


def test_real_site_session_report_matches_shared_json_schema() -> None:
    repository_root = Path(__file__).resolve().parents[2]
    schema = json.loads((repository_root / "contracts" / "session-report.schema.json").read_text())

    study_response = client.post(
        "/api/v1/studies/configurations",
        json={
            "name": "Real checkout study",
            "objective": "Measure whether visitors notice the checkout CTA.",
            "target_url": "https://example.com/pricing",
            "tasks": [{"prompt": "Find checkout."}],
            "aois": [
                {
                    "label": "Primary CTA",
                    "semantic_type": "CTA",
                    "role_key": "primary_cta",
                    "selector": "[data-gazetrack-aoi='primary_cta']",
                    "required": True,
                    "x": 0.5,
                    "y": 0.4,
                    "width": 0.2,
                    "height": 0.1,
                    "coordinate_space": "normalized",
                }
            ],
        },
    )
    assert study_response.status_code == 200
    study_id = study_response.json()["study"]["study_id"]
    config_response = client.get(f"/api/v1/studies/{study_id}/capture-snippet-config")
    assert config_response.status_code == 200
    capture_token = config_response.json()["capture_token"]
    session_response = client.post(
        f"/api/v1/studies/{study_id}/capture-sessions",
        json={"capture_token": capture_token},
    )
    assert session_response.status_code == 200
    session_id = session_response.json()["session_id"]

    snapshot_response = client.post(
        f"/api/v1/sessions/{session_id}/aoi-snapshots",
        json={
            "capture_token": capture_token,
            "snapshots": [
                {
                    "label": "Primary CTA",
                    "semantic_type": "CTA",
                    "role_key": "primary_cta",
                    "selector": "[data-gazetrack-aoi='primary_cta']",
                    "page_url": "https://example.com/pricing",
                    "x": 0.1,
                    "y": 0.2,
                    "width": 0.2,
                    "height": 0.1,
                    "coordinate_space": "document_normalized",
                    "detected": True,
                }
            ],
        },
    )
    assert snapshot_response.status_code == 200
    ingest_response = client.post(
        f"/api/v1/sessions/{session_id}/events",
        json={
            "capture_token": capture_token,
            "events": [
                {
                    "event_type": "page_view",
                    "timestamp": "2026-01-01T00:00:00.000Z",
                    "payload": {
                        "source": "real_site_capture",
                        "tracker_type": "real_site_capture",
                        "page_url": "https://example.com/pricing",
                        "page_path": "/pricing",
                        "document_width": 1200,
                        "document_height": 2400,
                        "viewport_width": 1200,
                        "viewport_height": 800,
                        "coordinate_space": "document_normalized",
                        "layout_snapshot": {
                            "snapshot_type": "safe_dom_layout_v1",
                            "page_url": "https://example.com/pricing",
                            "page_path": "/pricing",
                            "viewport_width": 1200,
                            "viewport_height": 800,
                            "document_width": 1200,
                            "document_height": 2400,
                            "scroll_x": 0,
                            "scroll_y": 0,
                            "coordinate_space": "document_normalized",
                            "landmarks": [
                                {
                                    "id": "primary_cta",
                                    "label": "Primary CTA",
                                    "semantic_type": "CTA",
                                    "x": 0.1,
                                    "y": 0.2,
                                    "width": 0.2,
                                    "height": 0.1,
                                    "is_aoi": True,
                                }
                            ],
                        },
                    },
                },
                {
                    "event_type": "task_start",
                    "timestamp": "2026-01-01T00:00:00.000Z",
                    "payload": {
                        "source": "real_site_capture",
                        "tracker_type": "real_site_capture",
                        "target": "Find checkout.",
                    },
                },
                {
                    "event_type": "gaze",
                    "timestamp": "2026-01-01T00:00:00.100Z",
                    "payload": {
                        "source": "real_site_capture",
                        "tracker_type": "real_site_capture",
                        "x": 0.15,
                        "y": 0.24,
                        "coordinate_space": "document_normalized",
                    },
                },
            ],
        },
    )
    assert ingest_response.status_code == 200
    assert ingest_response.json()["rejected_count"] == 0

    report_response = client.get(f"/api/v1/sessions/{session_id}/report")
    assert report_response.status_code == 200
    report = report_response.json()
    report_view_response = client.get(f"/api/v1/sessions/{session_id}/report-view")
    assert report_view_response.status_code == 200
    assert "text/html" in report_view_response.headers["content-type"]
    assert "GazeTrack report" in report_view_response.text
    assert "Real checkout study" in report_view_response.text
    assert "Heatmap" in report_view_response.text
    assert "Replay" in report_view_response.text
    assert "replay-data" in report_view_response.text
    assert "No raw webcam video" in report_view_response.text
    validation_errors = sorted(
        Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(report),
        key=lambda error: list(error.path),
    )

    assert validation_errors == [], "\n".join(
        f"{'/'.join(str(part) for part in error.path) or '<root>'}: {error.message}"
        for error in validation_errors
    )
    assert report["tracker_type"] == "real_site_capture"
    assert report["replay_summary"]["coordinate_space"] == "document_normalized"
    assert report["page_layouts"][0]["snapshot_type"] == "safe_dom_layout_v1"
    assert report["page_layouts"][0]["landmarks"][0]["label"] == "Primary CTA"
    assert not contains_media_like_fields(report)
