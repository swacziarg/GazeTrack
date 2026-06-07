"""Demo-grade fixation detection over normalized gaze telemetry.

This intentionally uses simple normalized-coordinate threshold clustering. It is
for deterministic product analytics demos, not medical-grade eye tracking.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from math import sqrt
from typing import Any

from app.models.api import EventEnvelope
from app.services.aoi_metrics import normalize_event_point, parse_event_timestamp

FIXATION_ALGORITHM = "simple_dispersion_v1"
FIXATION_ALGORITHM_NOTES = (
    "Demo-grade clustering of accepted normalized gaze samples by spatial radius and timestamp gap."
)
DEFAULT_RADIUS_THRESHOLD = 0.06
DEFAULT_MAX_GAP_MS = 250
DEFAULT_MIN_SAMPLE_COUNT = 3
DEFAULT_MIN_DURATION_MS = 100
MIN_USABLE_CONFIDENCE = 0.2


@dataclass(frozen=True)
class GazeSample:
    timestamp: str
    parsed_timestamp: datetime
    x: float
    y: float
    confidence: float | None = None


@dataclass(frozen=True)
class Fixation:
    id: str
    start_timestamp: str
    end_timestamp: str
    duration_ms: int
    centroid_x: float
    centroid_y: float
    sample_count: int
    average_confidence: float | None = None

    def model_dump(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "id": self.id,
            "start_timestamp": self.start_timestamp,
            "end_timestamp": self.end_timestamp,
            "duration_ms": self.duration_ms,
            "centroid_x": self.centroid_x,
            "centroid_y": self.centroid_y,
            "sample_count": self.sample_count,
        }
        if self.average_confidence is not None:
            payload["average_confidence"] = self.average_confidence
        return payload


def extract_confidence(payload: dict[str, Any]) -> float | None:
    confidence = payload.get("confidence")
    if isinstance(confidence, int | float):
        return float(confidence)

    quality = payload.get("quality")
    if isinstance(quality, dict):
        nested_confidence = quality.get("confidence")
        if isinstance(nested_confidence, int | float):
            return float(nested_confidence)

    return None


def _sample_from_event(event: EventEnvelope) -> GazeSample | None:
    if event.event_type.value != "gaze":
        return None

    point = normalize_event_point(event.payload)
    parsed_timestamp = parse_event_timestamp(event.timestamp)
    if point is None or parsed_timestamp is None:
        return None

    confidence = extract_confidence(event.payload)
    if confidence is not None and confidence < MIN_USABLE_CONFIDENCE:
        return None

    return GazeSample(
        timestamp=event.timestamp,
        parsed_timestamp=parsed_timestamp,
        x=point[0],
        y=point[1],
        confidence=confidence,
    )


def _distance(previous: GazeSample, current: GazeSample) -> float:
    return sqrt((current.x - previous.x) ** 2 + (current.y - previous.y) ** 2)


def _gap_ms(previous: GazeSample, current: GazeSample) -> int:
    return int((current.parsed_timestamp - previous.parsed_timestamp).total_seconds() * 1000)


def _average(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 3)


def _build_fixation(candidate: list[GazeSample], fixation_index: int, min_duration_ms: int) -> Fixation | None:
    if len(candidate) < DEFAULT_MIN_SAMPLE_COUNT:
        return None

    first = candidate[0]
    last = candidate[-1]
    duration_ms = _gap_ms(first, last)
    if duration_ms < min_duration_ms:
        return None

    confidences = [sample.confidence for sample in candidate if sample.confidence is not None]
    return Fixation(
        id=f"fixation-{fixation_index:03d}",
        start_timestamp=first.timestamp,
        end_timestamp=last.timestamp,
        duration_ms=duration_ms,
        centroid_x=round(sum(sample.x for sample in candidate) / len(candidate), 4),
        centroid_y=round(sum(sample.y for sample in candidate) / len(candidate), 4),
        sample_count=len(candidate),
        average_confidence=_average(confidences),
    )


def detect_fixations(
    events: list[EventEnvelope],
    radius_threshold: float = DEFAULT_RADIUS_THRESHOLD,
    max_gap_ms: int = DEFAULT_MAX_GAP_MS,
    min_duration_ms: int = DEFAULT_MIN_DURATION_MS,
) -> list[Fixation]:
    """Group nearby accepted gaze samples into deterministic fixation candidates."""
    samples = sorted(
        (sample for event in events if (sample := _sample_from_event(event)) is not None),
        key=lambda sample: sample.parsed_timestamp,
    )
    if not samples:
        return []

    fixations: list[Fixation] = []
    candidate: list[GazeSample] = [samples[0]]

    for sample in samples[1:]:
        previous = candidate[-1]
        if _distance(previous, sample) <= radius_threshold and 0 <= _gap_ms(previous, sample) <= max_gap_ms:
            candidate.append(sample)
            continue

        fixation = _build_fixation(candidate, len(fixations) + 1, min_duration_ms)
        if fixation is not None:
            fixations.append(fixation)
        candidate = [sample]

    fixation = _build_fixation(candidate, len(fixations) + 1, min_duration_ms)
    if fixation is not None:
        fixations.append(fixation)

    return fixations


def summarize_fixations(fixations: list[Fixation]) -> dict[str, Any]:
    durations = [fixation.duration_ms for fixation in fixations]
    confidences = [
        fixation.average_confidence
        for fixation in fixations
        if fixation.average_confidence is not None
    ]
    summary: dict[str, Any] = {
        "fixation_count": len(fixations),
        "total_fixation_dwell_ms": sum(durations),
        "average_fixation_duration_ms": round(sum(durations) / len(durations), 1) if durations else None,
        "fixation_algorithm": FIXATION_ALGORITHM,
        "fixation_algorithm_notes": FIXATION_ALGORITHM_NOTES,
    }
    average_confidence = _average(confidences)
    if average_confidence is not None:
        summary["average_fixation_confidence"] = average_confidence
    return summary
