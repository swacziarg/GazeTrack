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
