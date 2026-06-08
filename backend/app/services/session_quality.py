"""Heuristic session quality scoring for demo telemetry reports."""

from __future__ import annotations

from typing import Any

from app.models.api import EventEnvelope
from app.services.fixations import Fixation, extract_confidence

LOW_CONFIDENCE_THRESHOLD = 0.5
MAX_DEMO_EVENT_SCORE_COUNT = 10
HIGH_CALIBRATION_ERROR_PX = 100
WARN_CALIBRATION_ERROR_PX = 60
HIGH_CALIBRATION_ERROR_NORMALIZED = 0.18
WARN_CALIBRATION_ERROR_NORMALIZED = 0.08


def event_type_counts(events: list[EventEnvelope]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for event in events:
        event_type = event.event_type.value
        counts[event_type] = counts.get(event_type, 0) + 1
    return counts


def gaze_confidences(events: list[EventEnvelope]) -> list[float]:
    confidences: list[float] = []
    for event in events:
        if event.event_type.value != "gaze":
            continue
        confidence = extract_confidence(event.payload)
        if confidence is not None:
            confidences.append(confidence)
    return confidences


def low_confidence_sample_rate(confidences: list[float]) -> float | None:
    if not confidences:
        return None
    low_count = sum(1 for confidence in confidences if confidence < LOW_CONFIDENCE_THRESHOLD)
    return round(low_count / len(confidences), 3)


def average(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 3)


def _quality_sample_breakdown(events: list[EventEnvelope]) -> dict[str, Any]:
    gaze_events = [event for event in events if event.event_type.value == "gaze"]
    quality_counts = {"high": 0, "medium": 0, "low": 0}
    drift_warning_count = 0
    flag_counts: dict[str, int] = {}
    for event in gaze_events:
        tracking_quality = event.payload.get("tracking_quality")
        if tracking_quality in quality_counts:
            quality_counts[str(tracking_quality)] += 1
        flags = event.payload.get("quality_flags")
        if isinstance(flags, list) and flags:
            drift_warning_count += 1
            for flag in flags:
                if isinstance(flag, str):
                    flag_counts[flag] = flag_counts.get(flag, 0) + 1

    total = len(gaze_events)
    percentages = {
        key: (round(value / total, 3) if total else None)
        for key, value in quality_counts.items()
    }
    return {
        "tracking_quality_counts": quality_counts,
        "tracking_quality_percentages": percentages,
        "drift_warning_count": drift_warning_count,
        "quality_flag_counts": flag_counts,
        "major_quality_flags": sorted(flag_counts, key=flag_counts.get, reverse=True)[:5],
    }


def _camera_readiness_scores(events: list[EventEnvelope]) -> list[float]:
    scores: list[float] = []
    for event in events:
        if event.event_type.value != "calibration":
            continue
        value = event.payload.get("camera_readiness_score")
        if isinstance(value, int | float):
            scores.append(float(value))
    return scores


def _numeric_payload_values(events: list[EventEnvelope], event_type: str, keys: tuple[str, ...]) -> list[float]:
    values: list[float] = []
    for event in events:
        if event.event_type.value != event_type:
            continue
        for key in keys:
            value = event.payload.get(key)
            if isinstance(value, int | float):
                values.append(float(value))
                break
    return values


def _calibration_points_completed(events: list[EventEnvelope]) -> int | None:
    candidates = (
        "calibration_points_completed",
        "points_completed",
        "completed_points",
        "calibrationPointCount",
    )
    counts: list[int] = []
    for event in events:
        if event.event_type.value != "calibration":
            continue
        for key in candidates:
            value = event.payload.get(key)
            if isinstance(value, int | float):
                counts.append(int(value))
                break
            if isinstance(value, list):
                counts.append(len(value))
                break
    return max(counts) if counts else None


def _session_quality_score(events: list[EventEnvelope], confidences: list[float]) -> float | None:
    if not events:
        return None
    sample_integrity = min(len(events) / MAX_DEMO_EVENT_SCORE_COUNT, 1.0)
    confidence_score = sum(confidences) / len(confidences) if confidences else 0.7
    score = (sample_integrity * 0.4 + confidence_score * 0.6) * 100
    return round(score, 1)


def _sample_completeness_score(event_counts: dict[str, int]) -> float | None:
    gaze_count = event_counts.get("gaze", 0)
    if gaze_count == 0:
        return 0
    return round(min(gaze_count / 3, 1.0), 3)


def _quality_verdict(
    gaze_count: int,
    fixation_count: int,
    low_confidence_rate: float | None,
    average_calibration_error_px: float | None,
    average_calibration_error_normalized: float | None,
) -> tuple[str, list[str]]:
    reasons: list[str] = []

    if gaze_count == 0:
        return "fail", ["No accepted gaze events are present."]

    if average_calibration_error_px is not None and average_calibration_error_px > HIGH_CALIBRATION_ERROR_PX:
        return "fail", ["Average calibration error is above the demo fail threshold."]

    if (
        average_calibration_error_normalized is not None
        and average_calibration_error_normalized > HIGH_CALIBRATION_ERROR_NORMALIZED
    ):
        return "fail", ["Average normalized calibration error is above the demo fail threshold."]

    if low_confidence_rate is not None and low_confidence_rate > 0.35:
        reasons.append("Low-confidence gaze sample rate is above 35%.")

    if average_calibration_error_px is not None and average_calibration_error_px > WARN_CALIBRATION_ERROR_PX:
        reasons.append("Average calibration error is elevated for demo analytics.")

    if (
        average_calibration_error_normalized is not None
        and average_calibration_error_normalized > WARN_CALIBRATION_ERROR_NORMALIZED
    ):
        reasons.append("Average normalized calibration error is elevated for demo analytics.")

    if fixation_count == 0:
        reasons.append("No fixation candidates were detected from accepted gaze samples.")

    if reasons:
        return "warn", reasons

    return "pass", ["Gaze confidence and calibration signals are acceptable for synthetic demo analytics."]


def compute_quality_summary(events: list[EventEnvelope], fixations: list[Fixation]) -> dict[str, Any]:
    counts = event_type_counts(events)
    confidences = gaze_confidences(events)
    low_confidence_rate = low_confidence_sample_rate(confidences)
    calibration_errors_px = _numeric_payload_values(
        events,
        "calibration",
        ("calibration_error_px", "error_px", "average_calibration_error_px"),
    )
    calibration_errors_normalized = _numeric_payload_values(
        events,
        "calibration",
        (
            "calibration_error_normalized",
            "normalized_error",
            "average_calibration_error_normalized",
        ),
    )
    average_calibration_error_px = average(calibration_errors_px)
    average_calibration_error_normalized = average(calibration_errors_normalized)
    quality_breakdown = _quality_sample_breakdown(events)
    camera_readiness_scores = _camera_readiness_scores(events)
    quality_verdict, quality_reasons = _quality_verdict(
        gaze_count=counts.get("gaze", 0),
        fixation_count=len(fixations),
        low_confidence_rate=low_confidence_rate,
        average_calibration_error_px=average_calibration_error_px,
        average_calibration_error_normalized=average_calibration_error_normalized,
    )
    if quality_breakdown["drift_warning_count"] > 0:
        quality_reasons = [
            *quality_reasons,
            f"{quality_breakdown['drift_warning_count']} gaze samples include camera drift or setup quality warnings.",
        ]

    return {
        "score": _session_quality_score(events, confidences),
        "low_confidence_threshold": LOW_CONFIDENCE_THRESHOLD,
        "low_confidence_sample_rate": low_confidence_rate,
        "gaze_sample_count": counts.get("gaze", 0),
        "average_gaze_confidence": average(confidences),
        "calibration_event_count": counts.get("calibration", 0),
        "calibration_points_completed": _calibration_points_completed(events),
        "average_calibration_error_px": average_calibration_error_px,
        "average_calibration_error_normalized": average_calibration_error_normalized,
        "calibration_readiness_score": average(camera_readiness_scores),
        "quality_event_count": counts.get("quality", 0),
        "tracking_quality_counts": quality_breakdown["tracking_quality_counts"],
        "tracking_quality_percentages": quality_breakdown["tracking_quality_percentages"],
        "drift_warning_count": quality_breakdown["drift_warning_count"],
        "quality_flag_counts": quality_breakdown["quality_flag_counts"],
        "major_quality_flags": quality_breakdown["major_quality_flags"],
        "sample_integrity_basis_event_count": min(len(events), MAX_DEMO_EVENT_SCORE_COUNT),
        "sample_completeness_score": _sample_completeness_score(counts),
        "quality_verdict": quality_verdict,
        "quality_reasons": quality_reasons,
    }
