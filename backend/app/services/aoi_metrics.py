"""Demo AOI metric helpers for persisted synthetic telemetry."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.models.api import AoiMetricResponse, EventEnvelope
from app.repository import AoiRecord

MAX_DWELL_GAP_MS = 500
FALLBACK_SAMPLE_DWELL_MS = 100


def normalize_event_point(payload: dict[str, Any]) -> tuple[float, float] | None:
    point = payload.get("point")
    if isinstance(point, dict):
        raw_x = point.get("x")
        raw_y = point.get("y")
    else:
        raw_x = payload.get("x")
        raw_y = payload.get("y")

    if not isinstance(raw_x, int | float) or not isinstance(raw_y, int | float):
        return None

    x = float(raw_x)
    y = float(raw_y)
    if 0 <= x <= 1 and 0 <= y <= 1:
        return x, y

    viewport_width = payload.get("viewport_width")
    viewport_height = payload.get("viewport_height")
    if not isinstance(viewport_width, int | float) or not isinstance(viewport_height, int | float):
        return None
    if viewport_width <= 0 or viewport_height <= 0:
        return None

    normalized_x = x / float(viewport_width)
    normalized_y = y / float(viewport_height)
    if 0 <= normalized_x <= 1 and 0 <= normalized_y <= 1:
        return normalized_x, normalized_y
    return None


def is_point_inside_aoi(x: float, y: float, aoi: AoiRecord) -> bool:
    return aoi.x <= x <= aoi.x + aoi.width and aoi.y <= y <= aoi.y + aoi.height


def parse_event_timestamp(timestamp: object) -> datetime | None:
    if isinstance(timestamp, int | float):
        try:
            value = float(timestamp)
            if value > 10_000_000_000:
                value = value / 1000
            return datetime.fromtimestamp(value, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None

    if not isinstance(timestamp, str):
        return None

    try:
        return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        return None


def estimate_dwell_ms(timestamps: list[str], sample_count: int) -> int:
    parsed_timestamps = sorted(
        parsed_timestamp
        for timestamp in timestamps
        if (parsed_timestamp := parse_event_timestamp(timestamp)) is not None
    )
    if len(parsed_timestamps) < 2:
        return sample_count * FALLBACK_SAMPLE_DWELL_MS

    dwell_ms = 0
    for previous, current in zip(parsed_timestamps, parsed_timestamps[1:]):
        gap_ms = int((current - previous).total_seconds() * 1000)
        if 0 <= gap_ms <= MAX_DWELL_GAP_MS:
            dwell_ms += gap_ms
    return dwell_ms if dwell_ms > 0 else sample_count * FALLBACK_SAMPLE_DWELL_MS


def milliseconds_between(start_timestamp: str | None, end_timestamp: str | None) -> int | None:
    if start_timestamp is None or end_timestamp is None:
        return None
    start = parse_event_timestamp(start_timestamp)
    end = parse_event_timestamp(end_timestamp)
    if start is None or end is None:
        return None
    diff_ms = int((end - start).total_seconds() * 1000)
    return diff_ms if diff_ms >= 0 else None


def _fixation_centroid(fixation: Any) -> tuple[float, float] | None:
    raw_x = getattr(fixation, "centroid_x", None)
    raw_y = getattr(fixation, "centroid_y", None)
    if not isinstance(raw_x, int | float) or not isinstance(raw_y, int | float):
        return None
    return float(raw_x), float(raw_y)


def _fixation_start_timestamp(fixation: Any) -> str | None:
    timestamp = getattr(fixation, "start_timestamp", None)
    return timestamp if isinstance(timestamp, str) else None


def _fixation_duration_ms(fixation: Any) -> int:
    duration_ms = getattr(fixation, "duration_ms", 0)
    return int(duration_ms) if isinstance(duration_ms, int | float) and duration_ms > 0 else 0


def _fixation_confidence(fixation: Any) -> float | None:
    confidence = getattr(fixation, "average_confidence", None)
    return float(confidence) if isinstance(confidence, int | float) else None


def _average(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 3)


def compute_aoi_metrics(
    aois: list[AoiRecord],
    events: list[EventEnvelope],
    fixations: list[Any] | None = None,
    task_start_timestamp: str | None = None,
) -> list[AoiMetricResponse]:
    metrics: list[AoiMetricResponse] = []
    gaze_events = [event for event in events if event.event_type.value == "gaze"]
    click_events = [event for event in events if event.event_type.value == "click"]
    fixations = fixations or []

    for aoi in aois:
        gaze_timestamps: list[str] = []
        click_timestamps: list[str] = []
        aoi_fixation_start_timestamps: list[str] = []
        aoi_fixation_dwell_ms = 0
        aoi_fixation_confidences: list[float] = []

        for event in gaze_events:
            point = normalize_event_point(event.payload)
            if point is None:
                continue
            if is_point_inside_aoi(point[0], point[1], aoi):
                gaze_timestamps.append(event.timestamp)

        for event in click_events:
            point = normalize_event_point(event.payload)
            if point is None:
                continue
            if is_point_inside_aoi(point[0], point[1], aoi):
                click_timestamps.append(event.timestamp)

        for fixation in fixations:
            centroid = _fixation_centroid(fixation)
            if centroid is None or not is_point_inside_aoi(centroid[0], centroid[1], aoi):
                continue
            start_timestamp = _fixation_start_timestamp(fixation)
            if start_timestamp is not None:
                aoi_fixation_start_timestamps.append(start_timestamp)
            aoi_fixation_dwell_ms += _fixation_duration_ms(fixation)
            confidence = _fixation_confidence(fixation)
            if confidence is not None:
                aoi_fixation_confidences.append(confidence)

        sorted_gaze_timestamps = sorted(gaze_timestamps)
        sorted_click_timestamps = sorted(click_timestamps)
        sorted_fixation_timestamps = sorted(aoi_fixation_start_timestamps)
        first_fixation_timestamp = sorted_fixation_timestamps[0] if sorted_fixation_timestamps else None
        approximate_dwell_ms = estimate_dwell_ms(gaze_timestamps, len(gaze_timestamps))
        dwell_time_ms = aoi_fixation_dwell_ms if aoi_fixation_dwell_ms > 0 else approximate_dwell_ms
        click_after_fixation_ms = None
        if first_fixation_timestamp is not None:
            click_delays = [
                delay_ms
                for click_timestamp in sorted_click_timestamps
                if (delay_ms := milliseconds_between(first_fixation_timestamp, click_timestamp)) is not None
            ]
            click_after_fixation_ms = click_delays[0] if click_delays else None
        metrics.append(
            AoiMetricResponse(
                aoi_id=aoi.id,
                label=aoi.label,
                page_url=aoi.page_url,
                coordinate_space=aoi.coordinate_space,
                gaze_sample_count=len(gaze_timestamps),
                first_gaze_timestamp=sorted_gaze_timestamps[0] if sorted_gaze_timestamps else None,
                approximate_dwell_ms=approximate_dwell_ms,
                dwell_time_ms=dwell_time_ms,
                click_count_inside_aoi=len(click_timestamps),
                click_count=len(click_timestamps),
                fixation_count=len(aoi_fixation_start_timestamps),
                fixation_dwell_ms=aoi_fixation_dwell_ms,
                first_fixation_timestamp=first_fixation_timestamp,
                time_to_first_fixation_ms=milliseconds_between(task_start_timestamp, first_fixation_timestamp),
                click_after_fixation_ms=click_after_fixation_ms,
                average_fixation_confidence=_average(aoi_fixation_confidences),
            )
        )

    total_dwell_ms = sum(metric.dwell_time_ms for metric in metrics)
    if total_dwell_ms > 0:
        metrics = [
            metric.model_copy(update={"attention_share_pct": round((metric.dwell_time_ms / total_dwell_ms) * 100, 1)})
            for metric in metrics
        ]

    return metrics
