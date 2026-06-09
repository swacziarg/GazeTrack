import json
from pathlib import Path
import sqlite3
from uuid import uuid4

from fastapi.testclient import TestClient

from app.db import connect_database, initialize_database
from app.main import app
from app.models.api import EventEnvelope
from app.repository import GazeTrackRepository

client = TestClient(app)


def load_synthetic_fixture() -> dict[str, object]:
    fixture_path = Path(__file__).resolve().parents[2] / "contracts" / "fixtures" / "synthetic-event-batch.json"
    return json.loads(fixture_path.read_text())


def test_database_initialization_creates_core_tables() -> None:
    initialize_database()

    with connect_database() as connection:
        rows = connection.execute(
            """
            SELECT name
            FROM sqlite_master
            WHERE type = 'table' AND name IN ('studies', 'tasks', 'aois', 'sessions', 'telemetry_events', 'reports')
            """
        ).fetchall()

    assert {row["name"] for row in rows} == {"studies", "tasks", "aois", "sessions", "telemetry_events", "reports"}


def test_database_initialization_migrates_legacy_telemetry_table(tmp_path: Path) -> None:
    database_path = tmp_path / "legacy.db"
    with sqlite3.connect(database_path) as connection:
        connection.executescript(
            """
            CREATE TABLE telemetry_events (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                payload TEXT NOT NULL,
                accepted INTEGER NOT NULL,
                rejection_reason TEXT,
                created_at TEXT NOT NULL
            );
            """
        )

    initialize_database(f"sqlite:///{database_path}")

    with connect_database(f"sqlite:///{database_path}") as connection:
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(telemetry_events)").fetchall()}
        indexes = {row["name"] for row in connection.execute("PRAGMA index_list(telemetry_events)").fetchall()}

    assert "telemetry_source" in columns
    assert "event_schema_version" in columns
    assert "batch_id" in columns
    assert "client_event_id" in columns
    assert "idx_telemetry_events_source" in indexes
    assert "idx_telemetry_events_session_client_event_id" in indexes
    assert "idx_telemetry_events_session_batch_id" in indexes


def test_database_initialization_backfills_capture_tokens_for_legacy_studies(tmp_path: Path) -> None:
    database_path = tmp_path / "legacy-studies.db"
    with sqlite3.connect(database_path) as connection:
        connection.executescript(
            """
            CREATE TABLE studies (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                target_url TEXT,
                updated_at TEXT,
                created_at TEXT NOT NULL
            );

            INSERT INTO studies (id, title, description, target_url, updated_at, created_at)
            VALUES
                ('study-1', 'Legacy one', NULL, NULL, NULL, '2026-01-01T00:00:00Z'),
                ('study-2', 'Legacy two', NULL, NULL, NULL, '2026-01-01T00:00:00Z');
            """
        )

    initialize_database(f"sqlite:///{database_path}")

    with connect_database(f"sqlite:///{database_path}") as connection:
        tokens = [
            row["capture_token"]
            for row in connection.execute("SELECT capture_token FROM studies ORDER BY id").fetchall()
        ]

    assert all(tokens)
    assert len(set(tokens)) == 2


def test_repository_creates_study_and_session() -> None:
    repository = GazeTrackRepository()
    study = repository.create_study(title="Checkout study", description="Find the checkout CTA")
    session = repository.create_session(study.id)

    assert repository.get_study(study.id) == study
    assert session.study_id == study.id
    assert session.status == "started"


def test_api_creates_lists_studies_and_creates_session() -> None:
    create_response = client.post(
        "/api/v1/studies",
        json={"name": "Pricing page study", "objective": "Find the team plan", "target_url": "https://example.test"},
    )
    assert create_response.status_code == 200
    study = create_response.json()

    list_response = client.get("/api/v1/studies")
    session_response = client.post(f"/api/v1/studies/{study['study_id']}/sessions", json={})

    assert list_response.status_code == 200
    assert any(item["study_id"] == study["study_id"] for item in list_response.json())
    assert session_response.status_code == 200
    assert session_response.json()["study_id"] == study["study_id"]
    assert session_response.json()["persistence"] == "sqlite"


def test_persisted_events_survive_repository_reinstantiation() -> None:
    session_id = uuid4()
    event = EventEnvelope(
        event_type="gaze",
        timestamp="2026-01-01T00:00:00Z",
        payload={"x": 100, "y": 200, "confidence": 0.91},
    )

    first_repository = GazeTrackRepository()
    first_repository.append_accepted_events(session_id, [event])

    second_repository = GazeTrackRepository()
    events = second_repository.get_accepted_events(session_id)

    assert len(events) == 1
    assert events[0].payload["confidence"] == 0.91


def test_persisted_events_store_queryable_analytics_columns() -> None:
    repository = GazeTrackRepository()
    study = repository.create_study(title="Canonical telemetry study")
    repository.create_aoi(study_id=study.id, label="Primary CTA", x=0.5, y=0.35, width=0.2, height=0.2)
    session = repository.create_session(study.id)

    repository.append_accepted_events(
        session.id,
        [
            EventEnvelope(
                event_type="gaze",
                timestamp="2026-01-01T00:00:00Z",
                payload={
                    "source": "webgazer_experimental",
                    "tracker_type": "webgazer_experimental",
                    "x": 0.55,
                    "y": 0.45,
                    "confidence": 0.87,
                },
            )
        ],
    )

    with connect_database() as connection:
        row = connection.execute(
            """
            SELECT
                event_schema_version,
                telemetry_source,
                normalized_x,
                normalized_y,
                confidence,
                payload_byte_size,
                aoi_hit_count,
                ingested_at
            FROM telemetry_events
            WHERE session_id = ?
            """,
            (str(session.id),),
        ).fetchone()

    assert row["event_schema_version"] == 1
    assert row["telemetry_source"] == "webgazer_experimental"
    assert row["normalized_x"] == 0.55
    assert row["normalized_y"] == 0.45
    assert row["confidence"] == 0.87
    assert row["payload_byte_size"] > 0
    assert row["aoi_hit_count"] == 1
    assert row["ingested_at"] is not None


def test_report_generation_uses_persisted_events_and_saves_report() -> None:
    fixture = load_synthetic_fixture()
    session_id = fixture["session_id"]

    ingest_response = client.post(f"/api/v1/sessions/{session_id}/events", json=fixture)
    report_response = client.get(f"/api/v1/sessions/{session_id}/report")

    assert ingest_response.status_code == 200
    assert report_response.status_code == 200
    assert report_response.json()["event_count"] == len(fixture["events"])  # type: ignore[arg-type]

    with connect_database() as connection:
        row = connection.execute("SELECT COUNT(*) AS count FROM reports WHERE session_id = ?", (session_id,)).fetchone()

    assert row["count"] == 1


def test_privacy_unsafe_payloads_are_not_persisted() -> None:
    session_id = uuid4()
    payload = {
        "event_type": "gaze",
        "timestamp": "2026-01-01T00:00:00Z",
        "payload": {"x": 0.42, "webcam_frame": "<raw-bytes>"},
    }

    response = client.post(f"/api/v1/sessions/{session_id}/events", json=payload)

    assert response.status_code == 200
    assert response.json()["rejected_count"] == 1
    assert GazeTrackRepository().count_accepted_events(session_id) == 0
