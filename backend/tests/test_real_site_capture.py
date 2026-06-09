from fastapi.testclient import TestClient

from app.main import app
from app.models.api import EventEnvelope
from app.repository import GazeTrackRepository

client = TestClient(app)


def create_real_site_study(allowed_origins: list[str] | None = None) -> tuple[dict[str, object], str]:
    response = client.post(
        "/api/v1/studies/configurations",
        json={
            "name": "Real checkout study",
            "objective": "Measure whether visitors notice the checkout CTA.",
            "target_url": "https://example.com/pricing",
            "allowed_origins": allowed_origins or [],
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
                },
                {
                    "label": "Footer",
                    "semantic_type": "footer",
                    "role_key": "footer",
                    "required": False,
                    "x": 0,
                    "y": 0.9,
                    "width": 1,
                    "height": 0.1,
                    "coordinate_space": "normalized",
                },
            ],
        },
    )
    assert response.status_code == 200
    study = response.json()["study"]
    assert study["allowed_origins"] == (allowed_origins or [])
    config_response = client.get(f"/api/v1/studies/{study['study_id']}/capture-snippet-config")
    assert config_response.status_code == 200
    return study, config_response.json()["capture_token"]


def test_aoi_selector_schema_persists_and_capture_config_exposes_fixed_roles() -> None:
    study, capture_token = create_real_site_study()

    aois_response = client.get(f"/api/v1/studies/{study['study_id']}/aois")
    capture_config_response = client.get(f"/api/v1/studies/{study['study_id']}/capture-config")

    assert aois_response.status_code == 200
    aois = aois_response.json()
    assert aois[0]["role_key"] == "primary_cta"
    assert aois[0]["selector"] == "[data-gazetrack-aoi='primary_cta']"
    assert aois[0]["required"] is True
    assert "capture_token" not in capture_config_response.json()
    assert [aoi["role_key"] for aoi in capture_config_response.json()["aois"]] == ["primary_cta", "footer"]
    snippet_config_response = client.get(f"/api/v1/studies/{study['study_id']}/capture-snippet-config")
    assert snippet_config_response.json()["capture_token"] == capture_token


def test_capture_session_rejects_invalid_token() -> None:
    study, _capture_token = create_real_site_study()

    response = client.post(
        f"/api/v1/studies/{study['study_id']}/capture-sessions",
        json={"capture_token": "wrong"},
    )

    assert response.status_code == 403


def test_public_capture_namespace_rejects_invalid_tokens() -> None:
    study, capture_token = create_real_site_study()
    session_response = client.post(
        "/api/v1/capture/sessions",
        json={"study_id": study["study_id"], "capture_token": capture_token},
    )
    assert session_response.status_code == 200
    session_id = session_response.json()["session_id"]

    config_response = client.get(
        "/api/v1/capture/config",
        params={"study_id": study["study_id"], "capture_token": "wrong"},
    )
    session_start_response = client.post(
        "/api/v1/capture/sessions",
        json={"study_id": study["study_id"], "capture_token": "wrong"},
    )
    snapshot_response = client.post(
        f"/api/v1/capture/sessions/{session_id}/aoi-snapshots",
        json={"capture_token": "wrong", "snapshots": []},
    )
    events_response = client.post(
        f"/api/v1/capture/sessions/{session_id}/events",
        json={
            "capture_token": "wrong",
            "events": [
                {
                    "event_type": "task_start",
                    "timestamp": "2026-01-01T00:00:00Z",
                    "payload": {"source": "real_site_capture", "tracker_type": "real_site_capture"},
                }
            ],
        },
    )
    complete_response = client.post(
        f"/api/v1/capture/sessions/{session_id}/complete",
        json={"capture_token": "wrong"},
    )

    assert config_response.status_code == 403
    assert session_start_response.status_code == 403
    assert snapshot_response.status_code == 403
    assert events_response.status_code == 403
    assert complete_response.status_code == 403


def test_public_capture_namespace_happy_path() -> None:
    study, capture_token = create_real_site_study()

    config_response = client.get(
        "/api/v1/capture/config",
        params={"study_id": study["study_id"], "capture_token": capture_token},
    )
    assert config_response.status_code == 200
    config = config_response.json()
    assert config["study_id"] == study["study_id"]
    assert "capture_token" not in config
    assert [aoi["role_key"] for aoi in config["aois"]] == ["primary_cta", "footer"]

    session_response = client.post(
        "/api/v1/capture/sessions",
        json={
            "study_id": study["study_id"],
            "capture_token": capture_token,
            "page_url": "https://example.com/pricing",
            "viewport_width": 1440,
            "viewport_height": 900,
            "document_width": 1440,
            "document_height": 1800,
        },
    )
    assert session_response.status_code == 200
    session_id = session_response.json()["session_id"]

    snapshot_response = client.post(
        f"/api/v1/capture/sessions/{session_id}/aoi-snapshots",
        json={
            "capture_token": capture_token,
            "snapshots": [
                {
                    "source_aoi_id": config["aois"][0]["aoi_id"],
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
    assert len(snapshot_response.json()) == 1

    events_response = client.post(
        f"/api/v1/capture/sessions/{session_id}/events",
        json={
            "capture_token": capture_token,
            "events": [
                {
                    "event_type": "page_view",
                    "timestamp": "2026-01-01T00:00:00Z",
                    "payload": {
                        "source": "real_site_capture",
                        "tracker_type": "real_site_capture",
                        "page_url": "https://example.com/pricing",
                    },
                },
                {
                    "event_type": "task_start",
                    "timestamp": "2026-01-01T00:00:01Z",
                    "payload": {"source": "real_site_capture", "tracker_type": "real_site_capture"},
                },
                {
                    "event_type": "click",
                    "timestamp": "2026-01-01T00:00:02Z",
                    "payload": {
                        "source": "real_site_capture",
                        "tracker_type": "real_site_capture",
                        "x": 0.15,
                        "y": 0.25,
                    },
                },
                {
                    "event_type": "task_complete",
                    "timestamp": "2026-01-01T00:00:03Z",
                    "payload": {
                        "source": "real_site_capture",
                        "tracker_type": "real_site_capture",
                        "completed": True,
                    },
                },
            ],
        },
    )
    assert events_response.status_code == 200
    event_result = events_response.json()
    assert event_result["accepted_count"] == 4
    assert event_result["rejected_count"] == 0
    assert event_result["stored_count_for_session"] == 4

    complete_response = client.post(
        f"/api/v1/capture/sessions/{session_id}/complete",
        json={"capture_token": capture_token},
    )
    assert complete_response.status_code == 200
    assert complete_response.json()["completed"] is True
    assert complete_response.json()["event_count"] == 4

    report_response = client.get(f"/api/v1/sessions/{session_id}/report")
    report = report_response.json()
    assert report_response.status_code == 200
    assert report["completed"] is True
    assert report["tracker_type"] == "real_site_capture"
    assert report["event_type_counts"]["click"] == 1


def test_public_capture_namespace_allows_configured_origin() -> None:
    study, capture_token = create_real_site_study(allowed_origins=["https://example.com"])
    headers = {"Origin": "https://example.com"}

    config_response = client.get(
        "/api/v1/capture/config",
        params={"study_id": study["study_id"], "capture_token": capture_token},
        headers=headers,
    )
    assert config_response.status_code == 200

    session_response = client.post(
        "/api/v1/capture/sessions",
        json={"study_id": study["study_id"], "capture_token": capture_token},
        headers=headers,
    )
    assert session_response.status_code == 200
    session_id = session_response.json()["session_id"]

    snapshot_response = client.post(
        f"/api/v1/capture/sessions/{session_id}/aoi-snapshots",
        json={"capture_token": capture_token, "snapshots": []},
        headers=headers,
    )
    assert snapshot_response.status_code == 200

    events_response = client.post(
        f"/api/v1/capture/sessions/{session_id}/events",
        json={
            "capture_token": capture_token,
            "events": [
                {
                    "event_type": "task_start",
                    "timestamp": "2026-01-01T00:00:00Z",
                    "payload": {"source": "real_site_capture", "tracker_type": "real_site_capture"},
                }
            ],
        },
        headers=headers,
    )
    assert events_response.status_code == 200

    complete_response = client.post(
        f"/api/v1/capture/sessions/{session_id}/complete",
        json={"capture_token": capture_token},
        headers=headers,
    )
    assert complete_response.status_code == 200


def test_public_capture_namespace_rejects_disallowed_and_missing_origins() -> None:
    study, capture_token = create_real_site_study(allowed_origins=["https://allowed.example"])

    missing_origin_config = client.get(
        "/api/v1/capture/config",
        params={"study_id": study["study_id"], "capture_token": capture_token},
    )
    disallowed_config = client.get(
        "/api/v1/capture/config",
        params={"study_id": study["study_id"], "capture_token": capture_token},
        headers={"Origin": "https://blocked.example"},
    )
    disallowed_session_start = client.post(
        "/api/v1/capture/sessions",
        json={"study_id": study["study_id"], "capture_token": capture_token},
        headers={"Origin": "https://blocked.example"},
    )

    assert missing_origin_config.status_code == 403
    assert disallowed_config.status_code == 403
    assert disallowed_session_start.status_code == 403

    session_response = client.post(
        "/api/v1/capture/sessions",
        json={"study_id": study["study_id"], "capture_token": capture_token},
        headers={"Origin": "https://allowed.example"},
    )
    assert session_response.status_code == 200
    session_id = session_response.json()["session_id"]

    snapshot_response = client.post(
        f"/api/v1/capture/sessions/{session_id}/aoi-snapshots",
        json={"capture_token": capture_token, "snapshots": []},
        headers={"Origin": "https://blocked.example"},
    )
    events_response = client.post(
        f"/api/v1/capture/sessions/{session_id}/events",
        json={
            "capture_token": capture_token,
            "events": [
                {
                    "event_type": "task_start",
                    "timestamp": "2026-01-01T00:00:00Z",
                    "payload": {"source": "real_site_capture", "tracker_type": "real_site_capture"},
                }
            ],
        },
        headers={"Origin": "https://blocked.example"},
    )
    complete_response = client.post(
        f"/api/v1/capture/sessions/{session_id}/complete",
        json={"capture_token": capture_token},
        headers={"Origin": "https://blocked.example"},
    )

    assert snapshot_response.status_code == 403
    assert events_response.status_code == 403
    assert complete_response.status_code == 403


def test_public_capture_event_batch_retry_is_idempotent() -> None:
    study, capture_token = create_real_site_study()
    session_response = client.post(
        "/api/v1/capture/sessions",
        json={"study_id": study["study_id"], "capture_token": capture_token},
    )
    assert session_response.status_code == 200
    session_id = session_response.json()["session_id"]
    event_batch = {
        "capture_token": capture_token,
        "batch_id": "batch-retry-001",
        "events": [
            {
                "event_type": "page_view",
                "timestamp": "2026-01-01T00:00:00Z",
                "client_event_id": "event-page-view-001",
                "payload": {
                    "source": "real_site_capture",
                    "tracker_type": "real_site_capture",
                    "page_url": "https://example.com/pricing",
                },
            },
            {
                "event_type": "task_start",
                "timestamp": "2026-01-01T00:00:01Z",
                "client_event_id": "event-task-start-001",
                "payload": {"source": "real_site_capture", "tracker_type": "real_site_capture"},
            },
            {
                "event_type": "click",
                "timestamp": "2026-01-01T00:00:02Z",
                "client_event_id": "event-click-001",
                "payload": {
                    "source": "real_site_capture",
                    "tracker_type": "real_site_capture",
                    "x": 0.15,
                    "y": 0.25,
                },
            },
            {
                "event_type": "task_complete",
                "timestamp": "2026-01-01T00:00:03Z",
                "client_event_id": "event-task-complete-001",
                "payload": {
                    "source": "real_site_capture",
                    "tracker_type": "real_site_capture",
                    "completed": True,
                },
            },
        ],
    }

    first_response = client.post(f"/api/v1/capture/sessions/{session_id}/events", json=event_batch)
    retry_response = client.post(f"/api/v1/capture/sessions/{session_id}/events", json=event_batch)

    assert first_response.status_code == 200
    first_body = first_response.json()
    assert first_body["accepted_count"] == 4
    assert first_body["duplicate_count"] == 0
    assert first_body["skipped_count"] == 0
    assert first_body["stored_count_for_session"] == 4

    assert retry_response.status_code == 200
    retry_body = retry_response.json()
    assert retry_body["accepted_count"] == 4
    assert retry_body["rejected_count"] == 0
    assert retry_body["duplicate_count"] == 4
    assert retry_body["skipped_count"] == 4
    assert retry_body["stored_count_for_session"] == 4

    report_response = client.get(f"/api/v1/sessions/{session_id}/report")
    report = report_response.json()
    assert report_response.status_code == 200
    assert report["event_count"] == 4
    assert report["event_type_counts"]["click"] == 1


def test_aoi_snapshots_validate_document_normalized_bounds() -> None:
    study, capture_token = create_real_site_study()
    session_response = client.post(
        f"/api/v1/studies/{study['study_id']}/capture-sessions",
        json={"capture_token": capture_token},
    )
    session_id = session_response.json()["session_id"]

    response = client.post(
        f"/api/v1/sessions/{session_id}/aoi-snapshots",
        json={
            "capture_token": capture_token,
            "snapshots": [
                {
                    "label": "Broken CTA",
                    "role_key": "primary_cta",
                    "x": 0.9,
                    "y": 0.4,
                    "width": 0.2,
                    "height": 0.1,
                    "coordinate_space": "document_normalized",
                    "detected": True,
                }
            ],
        },
    )

    assert response.status_code == 422


def test_report_prefers_detected_session_aoi_snapshots_and_marks_unresolved() -> None:
    study, capture_token = create_real_site_study()
    session_response = client.post(
        f"/api/v1/studies/{study['study_id']}/capture-sessions",
        json={"capture_token": capture_token},
    )
    session_id = session_response.json()["session_id"]
    repository = GazeTrackRepository()
    persisted_aois = repository.list_aois_for_study(study["study_id"])

    snapshot_response = client.post(
        f"/api/v1/sessions/{session_id}/aoi-snapshots",
        json={
            "capture_token": capture_token,
            "snapshots": [
                {
                    "source_aoi_id": str(persisted_aois[0].id),
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
                },
                {
                    "source_aoi_id": str(persisted_aois[1].id),
                    "label": "Footer",
                    "semantic_type": "footer",
                    "role_key": "footer",
                    "page_url": "https://example.com/pricing",
                    "x": 0,
                    "y": 0,
                    "width": 0.01,
                    "height": 0.01,
                    "coordinate_space": "document_normalized",
                    "detected": False,
                },
            ],
        },
    )
    assert snapshot_response.status_code == 200

    repository.append_accepted_events(
        session_id,
        [
            EventEnvelope(event_type="task_start", timestamp="2026-01-01T00:00:00Z", payload={}),
            EventEnvelope(event_type="gaze", timestamp="2026-01-01T00:00:00.000Z", payload={"x": 0.15, "y": 0.24}),
            EventEnvelope(event_type="gaze", timestamp="2026-01-01T00:00:00.150Z", payload={"x": 0.16, "y": 0.25}),
            EventEnvelope(event_type="gaze", timestamp="2026-01-01T00:00:00.300Z", payload={"x": 0.17, "y": 0.26}),
            EventEnvelope(event_type="click", timestamp="2026-01-01T00:00:01.000Z", payload={"x": 0.16, "y": 0.25}),
        ],
    )

    report_response = client.get(f"/api/v1/sessions/{session_id}/report")
    report = report_response.json()

    assert report_response.status_code == 200
    assert report["aoi_count"] == 1
    assert report["replay_summary"]["coordinate_space"] == "document_normalized"
    assert report["aoi_metrics"][0]["coordinate_space"] == "document_normalized"
    assert report["aoi_metrics"][0]["gaze_sample_count"] == 3
    assert report["aoi_metrics"][0]["click_count"] == 1
    assert report["replay_aoi_overlay"] == [
        {
            "id": str(persisted_aois[0].id),
            "label": "Primary CTA",
            "x": 0.1,
            "y": 0.2,
            "width": 0.2,
            "height": 0.1,
            "coordinate_space": "document_normalized",
        }
    ]
    assert "AOI not detected on captured page: Footer." in report["insights"]
    assert all(aoi["label"] != "Footer" for aoi in report["weak_or_ignored_aois"])


def test_real_site_events_require_token_and_reject_media_payloads() -> None:
    study, capture_token = create_real_site_study()
    session_response = client.post(
        f"/api/v1/studies/{study['study_id']}/capture-sessions",
        json={"capture_token": capture_token},
    )
    session_id = session_response.json()["session_id"]

    rejected_response = client.post(
        f"/api/v1/sessions/{session_id}/events",
        json={
            "capture_token": "wrong",
            "event_type": "click",
            "timestamp": "2026-01-01T00:00:00Z",
            "payload": {
                "source": "real_site_capture",
                "tracker_type": "real_site_capture",
                "x": 0.2,
                "y": 0.3,
            },
        },
    )
    media_response = client.post(
        f"/api/v1/sessions/{session_id}/events",
        json={
            "capture_token": capture_token,
            "event_type": "click",
            "timestamp": "2026-01-01T00:00:00Z",
            "payload": {
                "source": "real_site_capture",
                "tracker_type": "real_site_capture",
                "x": 0.2,
                "y": 0.3,
                "screenshot_blob": "not allowed",
            },
        },
    )

    assert rejected_response.status_code == 200
    assert rejected_response.json()["accepted_count"] == 0
    assert rejected_response.json()["rejected_reasons"] == [
        "Rejected real-site event_type=click with invalid capture token."
    ]
    assert media_response.status_code == 200
    assert media_response.json()["accepted_count"] == 0
    assert media_response.json()["rejected_count"] == 1
