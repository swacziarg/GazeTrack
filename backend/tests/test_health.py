from fastapi.testclient import TestClient
import httpx

from app.main import app, WEBGAZER_MEDIAPIPE_BASE_URL

client = TestClient(app)


def test_health_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_local_frontend_cors_preflight_is_allowed() -> None:
    response = client.options(
        "/api/v1/sessions/11111111-1111-4111-8111-111111111111/events",
        headers={
            "Origin": "http://127.0.0.1:5175",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5175"


def test_shotzweb_localhost_cors_preflight_is_allowed() -> None:
    response = client.options(
        "/webgazer-mediapipe/face_mesh/face_mesh.binarypb",
        headers={
            "Origin": "http://127.0.0.1:3001",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3001"


def test_capture_script_is_served_at_legacy_and_versioned_paths() -> None:
    for path in ("/gazetrack-capture.js", "/sdk/v0.2/gazetrack-capture.js"):
        response = client.get(path)

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("application/javascript")
        assert "GazeTrackConfig" in response.text
        assert "real_site_capture" in response.text


def test_webgazer_mediapipe_proxy_fetches_from_fixed_upstream(monkeypatch) -> None:
    requested_urls: list[str] = []

    def fake_get(url: str, **_kwargs: object) -> httpx.Response:
        requested_urls.append(url)
        return httpx.Response(200, content=b"mesh", headers={"content-type": "application/octet-stream"})

    monkeypatch.setattr("app.main.httpx.get", fake_get)

    response = client.get("/webgazer-mediapipe/face_mesh/face_mesh.binarypb")

    assert response.status_code == 200
    assert response.content == b"mesh"
    assert requested_urls == [f"{WEBGAZER_MEDIAPIPE_BASE_URL}/face_mesh/face_mesh.binarypb"]


def test_webgazer_mediapipe_proxy_rejects_path_traversal() -> None:
    response = client.get("/webgazer-mediapipe/face_mesh/../secret")

    assert response.status_code == 404
