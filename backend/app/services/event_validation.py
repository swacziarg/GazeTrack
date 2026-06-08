"""Privacy and analytics validation for telemetry event ingestion."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from typing import Any

from app.models.api import EventEnvelope

SUSPICIOUS_MEDIA_KEYS = {"video", "frame", "image", "base64", "blob", "webcam_frame", "screenshot"}
MAX_PAYLOAD_BYTES = 4096
EVENT_SCHEMA_VERSION = 1
WEBGAZER_EXPERIMENTAL_SOURCE = "webgazer_experimental"
REAL_SITE_CAPTURE_SOURCE = "real_site_capture"

SAFE_PAYLOAD_KEYS = {
    "label",
    "source",
    "tracker_type",
    "synthetic",
    "mode",
    "aoi",
    "x",
    "y",
    "point",
    "viewport_width",
    "viewport_height",
    "confidence",
    "calibration_error_px",
    "calibration_error_normalized",
    "error_px",
    "error_normalized",
    "target_point",
    "observed_point",
    "calibration_step",
    "calibration_point_count",
    "calibration_points_completed",
    "calibration_quality",
    "calibration_recommendation",
    "quality_warning",
    "quality_score",
    "quality_flags",
    "camera_readiness_score",
    "tracking_quality",
    "camera_readiness_baseline",
    "drift_metrics",
    "dwell_ms",
    "scroll_depth_percent",
    "target",
    "task_prompt",
    "study_name",
    "target_url",
    "page_url",
    "page_path",
    "document_width",
    "document_height",
    "scroll_x",
    "scroll_y",
    "aoi_role_key",
    "coordinate_space",
    "completed",
}

POINT_KEYS = {"point", "target_point", "observed_point"}
QUALITY_LEVELS = {"high", "medium", "low"}
QUALITY_FLAGS = {
    "face_lost",
    "eye_visibility_lost",
    "face_center_drift",
    "face_size_drift",
    "head_pose_drift",
    "low_light",
    "sample_rate_low",
    "unstable_position",
}
BASELINE_NUMERIC_KEYS = {"brightness", "contrast", "observed_fps", "readiness_score", "face_size"}
DRIFT_NUMERIC_KEYS = {
    "face_center_drift",
    "face_size_drift",
    "head_pose_drift",
    "calibration_baseline_age_ms",
}
DRIFT_BOOL_KEYS = {"eye_visibility_lost", "face_lost", "low_light", "sample_rate_low"}


@dataclass(frozen=True)
class AcceptedTelemetryEvent:
    envelope: EventEnvelope
    event_schema_version: int
    telemetry_source: str | None
    normalized_x: float | None
    normalized_y: float | None
    confidence: float | None
    payload_byte_size: int


@dataclass(frozen=True)
class EventValidationResult:
    accepted_event: AcceptedTelemetryEvent | None = None
    rejection_reason: str | None = None

    @property
    def accepted(self) -> bool:
        return self.accepted_event is not None


def contains_media_like_fields(data: Any) -> bool:
    if isinstance(data, dict):
        for key, value in data.items():
            normalized_key = str(key).lower()
            if any(token in normalized_key for token in SUSPICIOUS_MEDIA_KEYS):
                return True
            if contains_media_like_fields(value):
                return True
    elif isinstance(data, list):
        for item in data:
            if contains_media_like_fields(item):
                return True
    return False


def parse_event_timestamp(timestamp: object) -> datetime | None:
    if isinstance(timestamp, bool):
        return None
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


def _is_number(value: object) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


def _round_coordinate(value: float) -> float:
    return round(value, 4)


def _round_metric(value: float) -> float:
    return round(value, 3)


def _sanitize_point(value: object) -> dict[str, float] | None:
    if not isinstance(value, dict):
        return None
    raw_x = value.get("x")
    raw_y = value.get("y")
    if not _is_number(raw_x) or not _is_number(raw_y):
        return None
    x = float(raw_x)
    y = float(raw_y)
    if not 0 <= x <= 1 or not 0 <= y <= 1:
        return None
    return {"x": _round_coordinate(x), "y": _round_coordinate(y)}


def _sanitize_quality_flags(value: object) -> list[str] | None:
    if not isinstance(value, list):
        return None
    flags = [str(item).strip() for item in value if str(item).strip() in QUALITY_FLAGS]
    return flags[:12]


def _sanitize_head_pose(value: object) -> dict[str, float | None] | None:
    if not isinstance(value, dict):
        return None
    pose: dict[str, float | None] = {}
    for key in ("yaw", "pitch", "roll"):
        raw_value = value.get(key)
        if raw_value is None:
            pose[key] = None
        elif _is_number(raw_value):
            pose[key] = _round_metric(float(raw_value))
    return pose or None


def _sanitize_camera_baseline(value: object) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    sanitized: dict[str, Any] = {}
    captured_at = value.get("captured_at")
    if isinstance(captured_at, str) and parse_event_timestamp(captured_at) is not None:
        sanitized["captured_at"] = captured_at
    point = _sanitize_point(value.get("face_center"))
    if point is not None:
        sanitized["face_center"] = point
    pose = _sanitize_head_pose(value.get("head_pose"))
    if pose is not None:
        sanitized["head_pose"] = pose
    for key in BASELINE_NUMERIC_KEYS:
        raw_value = value.get(key)
        if raw_value is None:
            sanitized[key] = None
        elif _is_number(raw_value):
            sanitized[key] = _round_metric(float(raw_value))
    return sanitized or None


def _sanitize_drift_metrics(value: object) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    sanitized: dict[str, Any] = {}
    for key in DRIFT_NUMERIC_KEYS:
        raw_value = value.get(key)
        if raw_value is None:
            sanitized[key] = None
        elif _is_number(raw_value):
            sanitized[key] = _round_metric(float(raw_value))
    for key in DRIFT_BOOL_KEYS:
        raw_value = value.get(key)
        if isinstance(raw_value, bool):
            sanitized[key] = raw_value
    quality = value.get("overall_tracking_quality")
    if isinstance(quality, str) and quality in QUALITY_LEVELS:
        sanitized["overall_tracking_quality"] = quality
    return sanitized or None


def _sanitize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    sanitized: dict[str, Any] = {}
    for key, value in payload.items():
        if key not in SAFE_PAYLOAD_KEYS:
            continue
        if key in POINT_KEYS:
            point = _sanitize_point(value)
            if point is not None:
                sanitized[key] = point
            continue
        if key in {"x", "y", "viewport_width", "viewport_height", "document_width", "document_height",
                   "scroll_x", "scroll_y", "confidence", "calibration_error_px",
                   "calibration_error_normalized", "error_px", "error_normalized", "dwell_ms",
                   "scroll_depth_percent", "quality_score", "camera_readiness_score"}:
            if value is None and key == "confidence":
                sanitized[key] = None
            elif _is_number(value):
                sanitized[key] = _round_metric(float(value))
            continue
        if key in {"synthetic", "completed"}:
            if isinstance(value, bool):
                sanitized[key] = value
            continue
        if key in {"calibration_step", "calibration_point_count", "calibration_points_completed"}:
            if _is_number(value):
                sanitized[key] = int(value)
            continue
        if isinstance(value, str):
            stripped = value.strip()
            if stripped:
                if key == "tracking_quality" and stripped not in QUALITY_LEVELS:
                    continue
                sanitized[key] = stripped[:1000]
            continue
        if key == "quality_flags":
            flags = _sanitize_quality_flags(value)
            if flags is not None:
                sanitized[key] = flags
            continue
        if key == "camera_readiness_baseline":
            baseline = _sanitize_camera_baseline(value)
            if baseline is not None:
                sanitized[key] = baseline
            continue
        if key == "drift_metrics":
            drift = _sanitize_drift_metrics(value)
            if drift is not None:
                sanitized[key] = drift
            continue
    return sanitized


def normalize_event_point(payload: dict[str, Any]) -> tuple[float, float] | None:
    point = payload.get("point")
    if isinstance(point, dict):
        raw_x = point.get("x")
        raw_y = point.get("y")
    else:
        raw_x = payload.get("x")
        raw_y = payload.get("y")

    if not _is_number(raw_x) or not _is_number(raw_y):
        return None

    x = float(raw_x)
    y = float(raw_y)
    if 0 <= x <= 1 and 0 <= y <= 1:
        return _round_coordinate(x), _round_coordinate(y)

    viewport_width = payload.get("viewport_width")
    viewport_height = payload.get("viewport_height")
    if not _is_number(viewport_width) or not _is_number(viewport_height):
        return None
    if float(viewport_width) <= 0 or float(viewport_height) <= 0:
        return None

    normalized_x = x / float(viewport_width)
    normalized_y = y / float(viewport_height)
    if 0 <= normalized_x <= 1 and 0 <= normalized_y <= 1:
        return _round_coordinate(normalized_x), _round_coordinate(normalized_y)
    return None


def extract_confidence(payload: dict[str, Any]) -> float | None:
    confidence = payload.get("confidence")
    if confidence is None:
        return None
    if not _is_number(confidence):
        return None
    return _round_metric(float(confidence))


def telemetry_source(payload: dict[str, Any]) -> str | None:
    for key in ("tracker_type", "source"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    if payload.get("synthetic") is True:
        return "synthetic"
    return None


def _payload_size(payload: dict[str, Any]) -> int:
    return len(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8"))


def _validate_confidence(confidence: float | None) -> str | None:
    if confidence is None:
        return None
    if not 0 <= confidence <= 1:
        return "Rejected confidence outside 0-1 range."
    return None


def _validate_scroll(payload: dict[str, Any]) -> str | None:
    depth = payload.get("scroll_depth_percent")
    if depth is None:
        return "Rejected scroll event without scroll_depth_percent."
    if not _is_number(depth) or not 0 <= float(depth) <= 100:
        return "Rejected scroll event with invalid scroll_depth_percent."
    return None


def _validate_calibration(payload: dict[str, Any]) -> str | None:
    if "target_point" in payload or "observed_point" in payload:
        return None
    calibration_keys = {
        "calibration_error_px",
        "calibration_error_normalized",
        "error_px",
        "error_normalized",
        "calibration_points_completed",
        "calibration_step",
    }
    if any(key in payload for key in calibration_keys):
        return None
    return "Rejected calibration event without calibration measurements."


def validate_event_for_ingest(event: EventEnvelope, has_task_context: bool = False) -> EventValidationResult:
    if contains_media_like_fields(event.payload):
        return EventValidationResult(rejection_reason=f"Rejected media-like payload fields in event_type={event.event_type.value}.")

    if parse_event_timestamp(event.timestamp) is None:
        return EventValidationResult(rejection_reason=f"Rejected event_type={event.event_type.value} with invalid timestamp.")

    raw_confidence = event.payload.get("confidence")
    if raw_confidence is not None and not _is_number(raw_confidence):
        return EventValidationResult(rejection_reason="Rejected confidence with non-numeric value.")

    sanitized_payload = _sanitize_payload(event.payload)
    payload_byte_size = _payload_size(sanitized_payload)
    if payload_byte_size > MAX_PAYLOAD_BYTES:
        return EventValidationResult(rejection_reason=f"Rejected event_type={event.event_type.value} payload over {MAX_PAYLOAD_BYTES} bytes.")

    source = telemetry_source(sanitized_payload)
    if source == WEBGAZER_EXPERIMENTAL_SOURCE and event.event_type.value != "task_start" and not has_task_context:
        return EventValidationResult(
            rejection_reason=(
                f"Rejected WebGazer event_type={event.event_type.value} without accepted task_start context."
            )
        )

    point = normalize_event_point(sanitized_payload)
    confidence = extract_confidence(sanitized_payload)
    confidence_error = _validate_confidence(confidence)
    if confidence_error is not None:
        return EventValidationResult(rejection_reason=confidence_error)

    if event.event_type.value in {"gaze", "click"}:
        if point is None:
            return EventValidationResult(
                rejection_reason=f"Rejected event_type={event.event_type.value} without valid normalized coordinates."
            )
        sanitized_payload["x"] = point[0]
        sanitized_payload["y"] = point[1]

    if event.event_type.value == "scroll":
        if reason := _validate_scroll(sanitized_payload):
            return EventValidationResult(rejection_reason=reason)

    if event.event_type.value == "calibration":
        if reason := _validate_calibration(sanitized_payload):
            return EventValidationResult(rejection_reason=reason)

    sanitized_event = EventEnvelope(
        event_type=event.event_type,
        timestamp=event.timestamp,
        payload=sanitized_payload,
    )

    return EventValidationResult(
        accepted_event=AcceptedTelemetryEvent(
            envelope=sanitized_event,
            event_schema_version=EVENT_SCHEMA_VERSION,
            telemetry_source=source,
            normalized_x=point[0] if point is not None else None,
            normalized_y=point[1] if point is not None else None,
            confidence=confidence,
            payload_byte_size=payload_byte_size,
        )
    )
