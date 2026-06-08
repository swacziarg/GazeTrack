"""Privacy-safe session replay payload helpers.

Replay is a schematic normalized-coordinate visualization. It never includes
raw event payloads, webcam frames, screenshots, blobs, or base64 media.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.models.api import EventEnvelope
from app.repository import AoiRecord
from app.services.aoi_metrics import is_point_inside_aoi, normalize_event_point, parse_event_timestamp
from app.services.fixations import Fixation, extract_confidence


REPLAY_COORDINATE_SPACES = {"normalized", "document_normalized"}
REPLAY_COORDINATE_SPACE = "normalized"


def _relative_ms(timestamp: str, session_start: datetime | None) -> int | None:
    parsed_timestamp = parse_event_timestamp(timestamp)
    if parsed_timestamp is None or session_start is None:
        return None

    delta_ms = int((parsed_timestamp - session_start).total_seconds() * 1000)
    return delta_ms if delta_ms >= 0 else None


def _session_start(events: list[EventEnvelope]) -> datetime | None:
    parsed_timestamps = [
        parsed_timestamp
        for event in events
        if (parsed_timestamp := parse_event_timestamp(event.timestamp)) is not None
    ]
    return min(parsed_timestamps) if parsed_timestamps else None


def _session_duration_ms(events: list[EventEnvelope], session_start: datetime | None) -> int:
    if session_start is None:
        return 0

    relative_values = [
        relative_ms
        for event in events
        if (relative_ms := _relative_ms(event.timestamp, session_start)) is not None
    ]
    return max(relative_values) if relative_values else 0


def _aoi_ids_for_point(x: float, y: float, aois: list[AoiRecord]) -> list[str]:
    return [str(aoi.id) for aoi in aois if is_point_inside_aoi(x, y, aoi)]


def _optional_text(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def _event_message(event: EventEnvelope) -> str | None:
    label = _optional_text(event.payload.get("label"))
    if label is not None:
        return label

    if event.event_type.value == "task_start":
        target = _optional_text(event.payload.get("target"))
        return f"Task started: {target}" if target else "Task started"
    if event.event_type.value == "task_complete":
        return "Task completed"
    if event.event_type.value == "scroll":
        depth = event.payload.get("scroll_depth_percent")
        if isinstance(depth, int | float):
            return f"Scrolled to {round(float(depth))}%"
        return "Scroll event"
    if event.event_type.value == "calibration":
        return "Calibration event"
    if event.event_type.value == "quality":
        return "Quality event"
    if event.event_type.value == "page_view":
        return "Page viewed"
    return None


def build_replay_aoi_overlay(aois: list[AoiRecord]) -> list[dict[str, Any]]:
    return [
        {
            "id": str(aoi.id),
            "label": aoi.label,
            "x": aoi.x,
            "y": aoi.y,
            "width": aoi.width,
            "height": aoi.height,
            "coordinate_space": aoi.coordinate_space,
        }
        for aoi in aois
        if aoi.coordinate_space in REPLAY_COORDINATE_SPACES
    ]


def build_replay_events(events: list[EventEnvelope], aois: list[AoiRecord]) -> list[dict[str, Any]]:
    session_start = _session_start(events)
    replay_events: list[dict[str, Any]] = []

    for index, event in enumerate(events):
        payload: dict[str, Any] = {
            "id": f"event-{index + 1:04d}",
            "type": event.event_type.value,
            "timestamp": event.timestamp,
            "relative_ms": _relative_ms(event.timestamp, session_start),
            "aoi_ids": [],
        }

        point = normalize_event_point(event.payload)
        if point is not None:
            payload["x"] = round(point[0], 4)
            payload["y"] = round(point[1], 4)
            payload["aoi_ids"] = _aoi_ids_for_point(point[0], point[1], aois)

        confidence = extract_confidence(event.payload)
        if confidence is not None:
            payload["confidence"] = round(confidence, 3)

        message = _event_message(event)
        if message is not None:
            payload["label"] = message
            payload["message"] = message

        source = _optional_text(event.payload.get("source"))
        if source is not None:
            payload["source"] = source

        replay_events.append(payload)

    return sorted(
        replay_events,
        key=lambda event: (
            event["relative_ms"] is None,
            event["relative_ms"] if event["relative_ms"] is not None else 0,
            event["timestamp"],
        ),
    )


def build_replay_fixations(fixations: list[Fixation], events: list[EventEnvelope], aois: list[AoiRecord]) -> list[dict[str, Any]]:
    session_start = _session_start(events)
    replay_fixations: list[dict[str, Any]] = []

    for fixation in fixations:
        start_relative_ms = _relative_ms(fixation.start_timestamp, session_start)
        end_relative_ms = _relative_ms(fixation.end_timestamp, session_start)
        payload: dict[str, Any] = {
            "id": fixation.id,
            "type": "fixation",
            "start_timestamp": fixation.start_timestamp,
            "end_timestamp": fixation.end_timestamp,
            "start_relative_ms": start_relative_ms,
            "end_relative_ms": end_relative_ms,
            "duration_ms": fixation.duration_ms,
            "x": fixation.centroid_x,
            "y": fixation.centroid_y,
            "sample_count": fixation.sample_count,
            "aoi_ids": _aoi_ids_for_point(fixation.centroid_x, fixation.centroid_y, aois),
        }
        if fixation.average_confidence is not None:
            payload["average_confidence"] = fixation.average_confidence
        replay_fixations.append(payload)

    return replay_fixations


def build_replay_summary(
    events: list[EventEnvelope],
    replay_events: list[dict[str, Any]],
    replay_fixations: list[dict[str, Any]],
) -> dict[str, Any]:
    counts: dict[str, int] = {}
    for event in events:
        counts[event.event_type.value] = counts.get(event.event_type.value, 0) + 1

    return {
        "event_count": len(replay_events),
        "gaze_event_count": counts.get("gaze", 0),
        "fixation_count": len(replay_fixations),
        "click_count": counts.get("click", 0),
        "scroll_count": counts.get("scroll", 0),
        "task_event_count": counts.get("task_start", 0) + counts.get("task_complete", 0),
        "duration_ms": _session_duration_ms(events, _session_start(events)),
        "coordinate_space": REPLAY_COORDINATE_SPACE,
    }
