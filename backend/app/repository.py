"""Repository boundary for durable GazeTrack demo persistence."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from typing import Any
from uuid import UUID, uuid4

from app.core.config import settings
from app.db import connect_database, initialize_database
from app.models.api import EventEnvelope

DEMO_STUDY_ID = UUID("00000000-0000-4000-8000-000000000001")

DEMO_TASKS = [
    {
        "title": "Find the main call to action",
        "prompt": "Explore the landing page and click the primary call-to-action when you find it.",
        "success_criteria": "User identifies and clicks the primary CTA.",
        "target_url": "https://example.test/pricing",
    }
]

DEMO_AOIS = [
    {
        "label": "Hero headline",
        "semantic_type": "hero",
        "page_url": "https://example.test/pricing",
        "x": 0.12,
        "y": 0.18,
        "width": 0.48,
        "height": 0.14,
    },
    {
        "label": "Primary CTA",
        "semantic_type": "CTA",
        "page_url": "https://example.test/pricing",
        "x": 0.52,
        "y": 0.38,
        "width": 0.2,
        "height": 0.12,
    },
    {
        "label": "Navigation",
        "semantic_type": "nav",
        "page_url": "https://example.test/pricing",
        "x": 0.38,
        "y": 0.05,
        "width": 0.24,
        "height": 0.11,
    },
    {
        "label": "Pricing preview",
        "semantic_type": "pricing",
        "page_url": "https://example.test/pricing",
        "x": 0.36,
        "y": 0.62,
        "width": 0.34,
        "height": 0.2,
    },
    {
        "label": "Footer",
        "semantic_type": "footer",
        "page_url": "https://example.test/pricing",
        "x": 0.0,
        "y": 0.88,
        "width": 1.0,
        "height": 0.12,
    },
]


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class StudyRecord:
    id: UUID
    title: str
    description: str | None
    target_url: str | None
    created_at: str
    updated_at: str | None


@dataclass(frozen=True)
class SessionRecord:
    id: UUID
    study_id: UUID
    status: str
    started_at: str
    ended_at: str | None
    quality_summary: dict[str, Any] | None
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class TaskRecord:
    id: UUID
    study_id: UUID
    title: str
    prompt: str
    success_criteria: str | None
    target_url: str | None
    created_at: str


@dataclass(frozen=True)
class AoiRecord:
    id: UUID
    study_id: UUID
    label: str
    page_url: str | None
    x: float
    y: float
    width: float
    height: float
    coordinate_space: str
    created_at: str
    semantic_type: str | None = None


@dataclass(frozen=True)
class TelemetryEventRecord:
    id: UUID
    session_id: UUID
    event_type: str
    timestamp: str
    payload: dict[str, Any]
    accepted: bool
    rejection_reason: str | None
    created_at: str

    def to_envelope(self) -> EventEnvelope:
        return EventEnvelope(event_type=self.event_type, timestamp=self.timestamp, payload=self.payload)


class GazeTrackRepository:
    def __init__(self, database_url: str | None = None) -> None:
        self.database_url = database_url or settings.database_url
        initialize_database(self.database_url)

    def create_study(
        self,
        title: str,
        description: str | None = None,
        target_url: str | None = None,
        study_id: UUID | None = None,
    ) -> StudyRecord:
        now = utcnow_iso()
        record_id = study_id or uuid4()
        with connect_database(self.database_url) as connection:
            connection.execute(
                """
                INSERT INTO studies (id, title, description, target_url, updated_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    description = excluded.description,
                    target_url = excluded.target_url,
                    updated_at = excluded.updated_at
                """,
                (str(record_id), title, description, target_url, now, now),
            )
        return StudyRecord(
            id=record_id,
            title=title,
            description=description,
            target_url=target_url,
            created_at=now,
            updated_at=now,
        )

    def ensure_default_study(self) -> StudyRecord:
        existing = self.get_study(DEMO_STUDY_ID)
        if existing is None:
            existing = self.create_study(
                title="Synthetic demo study",
                description="Default local study for synthetic telemetry sessions.",
                target_url="https://example.test/pricing",
                study_id=DEMO_STUDY_ID,
            )
        self.ensure_default_study_content(existing.id)
        return existing

    def ensure_default_study_content(self, study_id: UUID) -> None:
        if not self.list_tasks_for_study(study_id):
            for task in DEMO_TASKS:
                self.create_task(study_id=study_id, **task)
        if not self.list_aois_for_study(study_id):
            for aoi in DEMO_AOIS:
                self.create_aoi(study_id=study_id, **aoi)

    def get_study(self, study_id: UUID) -> StudyRecord | None:
        with connect_database(self.database_url) as connection:
            row = connection.execute(
                "SELECT id, title, description, target_url, created_at, updated_at FROM studies WHERE id = ?",
                (str(study_id),),
            ).fetchone()
        if row is None:
            return None
        return StudyRecord(
            id=UUID(row["id"]),
            title=row["title"],
            description=row["description"],
            target_url=row["target_url"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def list_studies(self) -> list[StudyRecord]:
        with connect_database(self.database_url) as connection:
            rows = connection.execute(
                "SELECT id, title, description, target_url, created_at, updated_at FROM studies ORDER BY created_at ASC"
            ).fetchall()
        return [
            StudyRecord(
                id=UUID(row["id"]),
                title=row["title"],
                description=row["description"],
                target_url=row["target_url"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
            )
            for row in rows
        ]

    def replace_study_configuration(
        self,
        study_id: UUID,
        title: str,
        description: str | None,
        target_url: str | None,
        tasks: list[dict[str, str | None]],
        aois: list[dict[str, str | float | None]],
    ) -> tuple[StudyRecord, list[TaskRecord], list[AoiRecord]]:
        existing = self.get_study(study_id)
        if existing is None:
            self.create_study(title=title, description=description, target_url=target_url, study_id=study_id)

        now = utcnow_iso()
        with connect_database(self.database_url) as connection:
            connection.execute(
                """
                UPDATE studies
                SET title = ?, description = ?, target_url = ?, updated_at = ?
                WHERE id = ?
                """,
                (title, description, target_url, now, str(study_id)),
            )
            connection.execute("DELETE FROM tasks WHERE study_id = ?", (str(study_id),))
            connection.execute("DELETE FROM aois WHERE study_id = ?", (str(study_id),))

        created_tasks = [
            self.create_task(
                study_id=study_id,
                title=str(task.get("title") or f"Task {index + 1}"),
                prompt=str(task["prompt"]),
                success_criteria=task.get("success_criteria"),
                target_url=task.get("target_url") or target_url,
            )
            for index, task in enumerate(tasks)
        ]
        created_aois = [
            self.create_aoi(
                study_id=study_id,
                label=str(aoi["label"]),
                semantic_type=aoi.get("semantic_type") if isinstance(aoi.get("semantic_type"), str) else None,
                page_url=aoi.get("page_url") if isinstance(aoi.get("page_url"), str) else target_url,
                x=float(aoi["x"]),
                y=float(aoi["y"]),
                width=float(aoi["width"]),
                height=float(aoi["height"]),
                coordinate_space=str(aoi.get("coordinate_space") or "normalized"),
            )
            for aoi in aois
        ]
        study = self.get_study(study_id) or StudyRecord(
            id=study_id,
            title=title,
            description=description,
            target_url=target_url,
            created_at=now,
            updated_at=now,
        )
        return study, created_tasks, created_aois

    def create_task(
        self,
        study_id: UUID,
        title: str,
        prompt: str,
        success_criteria: str | None = None,
        target_url: str | None = None,
        task_id: UUID | None = None,
    ) -> TaskRecord:
        if self.get_study(study_id) is None:
            raise ValueError("Study does not exist")

        now = utcnow_iso()
        record_id = task_id or uuid4()
        with connect_database(self.database_url) as connection:
            connection.execute(
                """
                INSERT INTO tasks (id, study_id, title, prompt, success_criteria, target_url, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (str(record_id), str(study_id), title, prompt, success_criteria, target_url, now),
            )
        return TaskRecord(
            id=record_id,
            study_id=study_id,
            title=title,
            prompt=prompt,
            success_criteria=success_criteria,
            target_url=target_url,
            created_at=now,
        )

    def list_tasks_for_study(self, study_id: UUID) -> list[TaskRecord]:
        with connect_database(self.database_url) as connection:
            rows = connection.execute(
                """
                SELECT id, study_id, title, prompt, success_criteria, target_url, created_at
                FROM tasks
                WHERE study_id = ?
                ORDER BY created_at ASC
                """,
                (str(study_id),),
            ).fetchall()
        return [
            TaskRecord(
                id=UUID(row["id"]),
                study_id=UUID(row["study_id"]),
                title=row["title"],
                prompt=row["prompt"],
                success_criteria=row["success_criteria"],
                target_url=row["target_url"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    def create_aoi(
        self,
        study_id: UUID,
        label: str,
        x: float,
        y: float,
        width: float,
        height: float,
        semantic_type: str | None = None,
        page_url: str | None = None,
        coordinate_space: str = "normalized",
        aoi_id: UUID | None = None,
    ) -> AoiRecord:
        if self.get_study(study_id) is None:
            raise ValueError("Study does not exist")

        now = utcnow_iso()
        record_id = aoi_id or uuid4()
        with connect_database(self.database_url) as connection:
            connection.execute(
                """
                INSERT INTO aois (
                    id, study_id, label, semantic_type, page_url, x, y, width, height, coordinate_space, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(record_id),
                    str(study_id),
                    label,
                    semantic_type,
                    page_url,
                    x,
                    y,
                    width,
                    height,
                    coordinate_space,
                    now,
                ),
            )
        return AoiRecord(
            id=record_id,
            study_id=study_id,
            label=label,
            semantic_type=semantic_type,
            page_url=page_url,
            x=x,
            y=y,
            width=width,
            height=height,
            coordinate_space=coordinate_space,
            created_at=now,
        )

    def list_aois_for_study(self, study_id: UUID) -> list[AoiRecord]:
        with connect_database(self.database_url) as connection:
            rows = connection.execute(
                """
                SELECT id, study_id, label, semantic_type, page_url, x, y, width, height, coordinate_space, created_at
                FROM aois
                WHERE study_id = ?
                ORDER BY created_at ASC
                """,
                (str(study_id),),
            ).fetchall()
        return [
            AoiRecord(
                id=UUID(row["id"]),
                study_id=UUID(row["study_id"]),
                label=row["label"],
                semantic_type=row["semantic_type"],
                page_url=row["page_url"],
                x=float(row["x"]),
                y=float(row["y"]),
                width=float(row["width"]),
                height=float(row["height"]),
                coordinate_space=row["coordinate_space"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    def create_session(self, study_id: UUID, session_id: UUID | None = None) -> SessionRecord:
        if self.get_study(study_id) is None:
            self.create_study(title="Demo study", description="Created automatically for local demo sessions.", study_id=study_id)

        now = utcnow_iso()
        record_id = session_id or uuid4()
        with connect_database(self.database_url) as connection:
            connection.execute(
                """
                INSERT INTO sessions (
                    id, study_id, status, started_at, ended_at, quality_summary, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)
                ON CONFLICT(id) DO NOTHING
                """,
                (str(record_id), str(study_id), "started", now, now, now),
            )
        return self.get_session(record_id) or SessionRecord(
            id=record_id,
            study_id=study_id,
            status="started",
            started_at=now,
            ended_at=None,
            quality_summary=None,
            created_at=now,
            updated_at=now,
        )

    def ensure_session(self, session_id: UUID, study_id: UUID | None = None) -> SessionRecord:
        existing = self.get_session(session_id)
        if existing is not None:
            return existing
        resolved_study_id = study_id or self.ensure_default_study().id
        return self.create_session(resolved_study_id, session_id=session_id)

    def get_session(self, session_id: UUID) -> SessionRecord | None:
        with connect_database(self.database_url) as connection:
            row = connection.execute(
                """
                SELECT id, study_id, status, started_at, ended_at, quality_summary, created_at, updated_at
                FROM sessions
                WHERE id = ?
                """,
                (str(session_id),),
            ).fetchone()
        if row is None:
            return None
        quality_summary = json.loads(row["quality_summary"]) if row["quality_summary"] else None
        return SessionRecord(
            id=UUID(row["id"]),
            study_id=UUID(row["study_id"]),
            status=row["status"],
            started_at=row["started_at"],
            ended_at=row["ended_at"],
            quality_summary=quality_summary,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def complete_session(self, session_id: UUID, quality_summary: dict[str, Any] | None = None) -> SessionRecord:
        record = self.ensure_session(session_id)
        now = utcnow_iso()
        quality_json = json.dumps(quality_summary, sort_keys=True) if quality_summary is not None else record.quality_summary
        with connect_database(self.database_url) as connection:
            connection.execute(
                """
                UPDATE sessions
                SET status = ?, ended_at = ?, quality_summary = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    "completed",
                    now,
                    quality_json if isinstance(quality_json, str) else json.dumps(quality_json, sort_keys=True),
                    now,
                    str(session_id),
                ),
            )
        return self.get_session(session_id) or record

    def append_accepted_events(self, session_id: UUID, events: list[EventEnvelope]) -> int:
        self.ensure_session(session_id)
        now = utcnow_iso()
        rows = [
            (
                str(uuid4()),
                str(session_id),
                event.event_type.value,
                event.timestamp,
                json.dumps(event.payload, sort_keys=True),
                1,
                None,
                now,
            )
            for event in events
        ]
        if rows:
            with connect_database(self.database_url) as connection:
                connection.executemany(
                    """
                    INSERT INTO telemetry_events (
                        id, session_id, event_type, timestamp, payload, accepted, rejection_reason, created_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    rows,
                )
        return self.count_accepted_events(session_id)

    def count_accepted_events(self, session_id: UUID) -> int:
        with connect_database(self.database_url) as connection:
            row = connection.execute(
                "SELECT COUNT(*) AS count FROM telemetry_events WHERE session_id = ? AND accepted = 1",
                (str(session_id),),
            ).fetchone()
        return int(row["count"] if row else 0)

    def get_accepted_events(self, session_id: UUID) -> list[TelemetryEventRecord]:
        with connect_database(self.database_url) as connection:
            rows = connection.execute(
                """
                SELECT id, session_id, event_type, timestamp, payload, accepted, rejection_reason, created_at
                FROM telemetry_events
                WHERE session_id = ? AND accepted = 1
                ORDER BY timestamp ASC, created_at ASC
                """,
                (str(session_id),),
            ).fetchall()
        return [
            TelemetryEventRecord(
                id=UUID(row["id"]),
                session_id=UUID(row["session_id"]),
                event_type=row["event_type"],
                timestamp=row["timestamp"],
                payload=json.loads(row["payload"]),
                accepted=bool(row["accepted"]),
                rejection_reason=row["rejection_reason"],
                created_at=row["created_at"],
            )
            for row in rows
        ]

    def save_report(self, session_id: UUID, report_payload: dict[str, Any]) -> UUID:
        self.ensure_session(session_id)
        report_id = uuid4()
        with connect_database(self.database_url) as connection:
            connection.execute(
                """
                INSERT INTO reports (id, session_id, report_payload, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (str(report_id), str(session_id), json.dumps(report_payload, sort_keys=True), utcnow_iso()),
            )
        return report_id


def get_repository() -> GazeTrackRepository:
    return GazeTrackRepository()
