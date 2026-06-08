"""SQLite persistence helpers for local GazeTrack development."""

from pathlib import Path
import secrets
import sqlite3
from urllib.parse import unquote, urlparse

from app.core.config import settings


def sqlite_path_from_url(database_url: str) -> str:
    parsed = urlparse(database_url)
    if parsed.scheme != "sqlite":
        raise ValueError("Only sqlite database URLs are supported by the local repository")

    if parsed.path in {"", "/"}:
        raise ValueError("SQLite database URL must include a database path")

    if parsed.path == "/:memory:":
        return ":memory:"

    if parsed.netloc:
        return unquote(f"/{parsed.netloc}{parsed.path}")

    path = unquote(parsed.path)
    if path.startswith("/") and not database_url.startswith("sqlite:////"):
        path = path[1:]
    return path


def connect_database(database_url: str | None = None) -> sqlite3.Connection:
    url = database_url or settings.database_url
    database_path = sqlite_path_from_url(url)
    if database_path != ":memory:":
        Path(database_path).parent.mkdir(parents=True, exist_ok=True)

    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database(database_url: str | None = None) -> None:
    with connect_database(database_url) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS studies (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                target_url TEXT,
                capture_token TEXT,
                updated_at TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                study_id TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                quality_summary TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (study_id) REFERENCES studies(id)
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                study_id TEXT NOT NULL,
                title TEXT NOT NULL,
                prompt TEXT NOT NULL,
                success_criteria TEXT,
                target_url TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (study_id) REFERENCES studies(id)
            );

            CREATE INDEX IF NOT EXISTS idx_tasks_study_id
                ON tasks(study_id);

            CREATE TABLE IF NOT EXISTS aois (
                id TEXT PRIMARY KEY,
                study_id TEXT NOT NULL,
                label TEXT NOT NULL,
                semantic_type TEXT,
                role_key TEXT,
                selector TEXT,
                required INTEGER NOT NULL DEFAULT 1,
                page_url TEXT,
                x REAL NOT NULL,
                y REAL NOT NULL,
                width REAL NOT NULL,
                height REAL NOT NULL,
                coordinate_space TEXT NOT NULL DEFAULT 'normalized',
                created_at TEXT NOT NULL,
                FOREIGN KEY (study_id) REFERENCES studies(id)
            );

            CREATE INDEX IF NOT EXISTS idx_aois_study_id
                ON aois(study_id);

            CREATE TABLE IF NOT EXISTS aoi_snapshots (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                study_id TEXT NOT NULL,
                source_aoi_id TEXT,
                label TEXT NOT NULL,
                semantic_type TEXT,
                role_key TEXT,
                selector TEXT,
                page_url TEXT,
                x REAL NOT NULL,
                y REAL NOT NULL,
                width REAL NOT NULL,
                height REAL NOT NULL,
                coordinate_space TEXT NOT NULL DEFAULT 'document_normalized',
                detected INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id),
                FOREIGN KEY (study_id) REFERENCES studies(id),
                FOREIGN KEY (source_aoi_id) REFERENCES aois(id)
            );

            CREATE INDEX IF NOT EXISTS idx_aoi_snapshots_session_id
                ON aoi_snapshots(session_id);

            CREATE TABLE IF NOT EXISTS telemetry_events (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                payload TEXT NOT NULL,
                event_schema_version INTEGER NOT NULL DEFAULT 1,
                telemetry_source TEXT,
                normalized_x REAL,
                normalized_y REAL,
                confidence REAL,
                payload_byte_size INTEGER NOT NULL DEFAULT 0,
                aoi_hit_count INTEGER NOT NULL DEFAULT 0,
                ingested_at TEXT,
                accepted INTEGER NOT NULL,
                rejection_reason TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );

            CREATE INDEX IF NOT EXISTS idx_telemetry_events_session_id
                ON telemetry_events(session_id);

            CREATE INDEX IF NOT EXISTS idx_telemetry_events_session_timestamp
                ON telemetry_events(session_id, timestamp);

            CREATE INDEX IF NOT EXISTS idx_telemetry_events_session_type
                ON telemetry_events(session_id, event_type);

            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                report_payload TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );

            CREATE INDEX IF NOT EXISTS idx_reports_session_id
                ON reports(session_id);
            """
        )
        _ensure_column(connection, "studies", "target_url", "TEXT")
        _ensure_column(connection, "studies", "capture_token", "TEXT")
        _backfill_capture_tokens(connection)
        _ensure_column(connection, "studies", "updated_at", "TEXT")
        _ensure_column(connection, "aois", "semantic_type", "TEXT")
        _ensure_column(connection, "aois", "role_key", "TEXT")
        _ensure_column(connection, "aois", "selector", "TEXT")
        _ensure_column(connection, "aois", "required", "INTEGER NOT NULL DEFAULT 1")
        _ensure_column(connection, "telemetry_events", "event_schema_version", "INTEGER NOT NULL DEFAULT 1")
        _ensure_column(connection, "telemetry_events", "telemetry_source", "TEXT")
        _ensure_column(connection, "telemetry_events", "normalized_x", "REAL")
        _ensure_column(connection, "telemetry_events", "normalized_y", "REAL")
        _ensure_column(connection, "telemetry_events", "confidence", "REAL")
        _ensure_column(connection, "telemetry_events", "payload_byte_size", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(connection, "telemetry_events", "aoi_hit_count", "INTEGER NOT NULL DEFAULT 0")
        _ensure_column(connection, "telemetry_events", "ingested_at", "TEXT")
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_telemetry_events_source ON telemetry_events(telemetry_source)"
        )


def _ensure_column(connection: sqlite3.Connection, table_name: str, column_name: str, column_definition: str) -> None:
    existing_columns = {row["name"] for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()}
    if column_name not in existing_columns:
        connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}")


def _backfill_capture_tokens(connection: sqlite3.Connection) -> None:
    rows = connection.execute(
        "SELECT id FROM studies WHERE capture_token IS NULL OR capture_token = ''"
    ).fetchall()
    for row in rows:
        connection.execute(
            "UPDATE studies SET capture_token = ? WHERE id = ?",
            (secrets.token_urlsafe(24), row["id"]),
        )


def reset_database(database_url: str | None = None) -> None:
    with connect_database(database_url) as connection:
        connection.executescript(
            """
            DROP TABLE IF EXISTS reports;
            DROP TABLE IF EXISTS telemetry_events;
            DROP TABLE IF EXISTS aoi_snapshots;
            DROP TABLE IF EXISTS aois;
            DROP TABLE IF EXISTS tasks;
            DROP TABLE IF EXISTS sessions;
            DROP TABLE IF EXISTS studies;
            """
        )
    initialize_database(database_url)
