from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_meta_returns_gazeops_metadata() -> None:
    response = client.get("/api/v1/meta")
    assert response.status_code == 200
    body = response.json()
    assert body["project"] == "GazeOps"
    assert "privacy_posture" in body


def test_placeholder_report_keys() -> None:
    session_id = uuid4()
    response = client.get(f"/api/v1/sessions/{session_id}/report")
    assert response.status_code == 200
    body = response.json()
    assert {"session_id", "report_status", "generated_at", "metrics", "notes"}.issubset(body.keys())
