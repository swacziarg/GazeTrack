from app.models.api import EventEnvelope
from app.repository import AoiRecord, DEMO_STUDY_ID
from app.services.aoi_metrics import compute_aoi_metrics, parse_event_timestamp
from app.services.fixations import detect_fixations, summarize_fixations
from app.services.session_quality import compute_quality_summary


def gaze(timestamp: str, x: float | None, y: float | None, confidence: float = 0.9) -> EventEnvelope:
    payload = {"confidence": confidence}
    if x is not None:
        payload["x"] = x
    if y is not None:
        payload["y"] = y
    return EventEnvelope(event_type="gaze", timestamp=timestamp, payload=payload)


def calibration(timestamp: str, error_px: float, error_normalized: float = 0.03) -> EventEnvelope:
    return EventEnvelope(
        event_type="calibration",
        timestamp=timestamp,
        payload={
            "target_point": {"x": 0.5, "y": 0.5},
            "observed_point": {"x": 0.52, "y": 0.48},
            "error_px": error_px,
            "error_normalized": error_normalized,
            "calibration_step": 1,
            "calibration_points_completed": 5,
            "confidence": 0.9,
            "synthetic": True,
        },
    )


def rich_synthetic_events(mode: str = "healthy") -> list[EventEnvelope]:
    if mode == "no_gaze":
        return [
            EventEnvelope(event_type="task_start", timestamp="2026-01-01T00:00:00.000Z", payload={}),
            calibration("2026-01-01T00:00:00.500Z", 26),
            EventEnvelope(event_type="task_complete", timestamp="2026-01-01T00:00:04.000Z", payload={"completed": True}),
        ]

    confidence = 0.36 if mode == "low_confidence" else 0.9
    calibration_error = 128 if mode == "bad_calibration" else 26
    calibration_normalized = 0.2 if mode == "bad_calibration" else 0.03
    events = [
        EventEnvelope(event_type="task_start", timestamp="2026-01-01T00:00:00.000Z", payload={}),
        calibration("2026-01-01T00:00:00.500Z", calibration_error, calibration_normalized),
    ]
    centers = [
        ("Navigation", 0.5, 0.1, 1100),
        ("Hero headline", 0.36, 0.25, 2200),
        ("Primary CTA", 0.62, 0.44, 3300),
        ("Pricing preview", 0.53, 0.72, 4400),
    ]
    for aoi, center_x, center_y, start_ms in centers:
        for index in range(8):
            events.append(
                EventEnvelope(
                    event_type="gaze",
                    timestamp=f"2026-01-01T00:00:{(start_ms + index * 80) / 1000:06.3f}Z",
                    payload={
                        "aoi": aoi,
                        "x": round(center_x + ((index % 3) - 1) * 0.006, 4),
                        "y": round(center_y + ((index % 2) - 0.5) * 0.008, 4),
                        "confidence": confidence,
                        "synthetic": True,
                    },
                )
            )
    events.extend(
        [
            EventEnvelope(
                event_type="click",
                timestamp="2026-01-01T00:00:05.200Z",
                payload={"x": 0.62, "y": 0.44, "synthetic": True},
            ),
            EventEnvelope(event_type="task_complete", timestamp="2026-01-01T00:00:06.000Z", payload={"completed": True}),
        ]
    )
    return events


def test_fixation_detection_groups_nearby_samples_into_fixation() -> None:
    fixations = detect_fixations(
        [
            gaze("2026-01-01T00:00:00.000Z", 0.5, 0.5, 0.9),
            gaze("2026-01-01T00:00:00.080Z", 0.51, 0.505, 0.8),
            gaze("2026-01-01T00:00:00.160Z", 0.515, 0.51, 0.85),
        ]
    )

    assert len(fixations) == 1
    assert fixations[0].duration_ms == 160
    assert fixations[0].sample_count == 3
    assert fixations[0].average_confidence == 0.85


def test_fixation_detection_rejects_too_short_or_too_small_candidates() -> None:
    assert detect_fixations(
        [
            gaze("2026-01-01T00:00:00.000Z", 0.5, 0.5),
            gaze("2026-01-01T00:00:00.030Z", 0.51, 0.505),
            gaze("2026-01-01T00:00:00.060Z", 0.515, 0.51),
        ]
    ) == []
    assert detect_fixations(
        [
            gaze("2026-01-01T00:00:00.000Z", 0.5, 0.5),
            gaze("2026-01-01T00:00:00.160Z", 0.51, 0.505),
        ]
    ) == []


def test_fixation_detection_handles_missing_timestamps_and_coordinates_safely() -> None:
    fixations = detect_fixations(
        [
            gaze("not-a-timestamp", 0.5, 0.5),
            gaze("2026-01-01T00:00:00.080Z", None, 0.5),
            gaze("2026-01-01T00:00:00.160Z", 0.51, None),
        ]
    )

    assert fixations == []


def test_fixation_summary_contains_algorithm_metadata() -> None:
    fixations = detect_fixations(
        [
            gaze("2026-01-01T00:00:00.000Z", 0.5, 0.5),
            gaze("2026-01-01T00:00:00.080Z", 0.51, 0.505),
            gaze("2026-01-01T00:00:00.160Z", 0.515, 0.51),
        ]
    )

    summary = summarize_fixations(fixations)

    assert summary["fixation_count"] == 1
    assert summary["total_fixation_dwell_ms"] == 160
    assert summary["fixation_algorithm"] == "simple_dispersion_v1"


def test_quality_verdict_fails_when_no_gaze_events_exist() -> None:
    summary = compute_quality_summary([], [])

    assert summary["quality_verdict"] == "fail"
    assert summary["quality_reasons"] == ["No accepted gaze events are present."]


def test_quality_verdict_warns_on_high_low_confidence_rate() -> None:
    events = [
        gaze("2026-01-01T00:00:00.000Z", 0.5, 0.5, 0.3),
        gaze("2026-01-01T00:00:00.080Z", 0.51, 0.505, 0.3),
        gaze("2026-01-01T00:00:00.160Z", 0.515, 0.51, 0.3),
    ]
    summary = compute_quality_summary(events, detect_fixations(events))

    assert summary["quality_verdict"] == "warn"
    assert summary["low_confidence_sample_rate"] == 1
    assert "Low-confidence gaze sample rate is above 35%." in summary["quality_reasons"]


def test_quality_verdict_passes_on_healthy_synthetic_session() -> None:
    events = [
        EventEnvelope(
            event_type="calibration",
            timestamp="2026-01-01T00:00:00.000Z",
            payload={"calibration_error_px": 32, "calibration_points_completed": 5},
        ),
        gaze("2026-01-01T00:00:00.100Z", 0.5, 0.5, 0.9),
        gaze("2026-01-01T00:00:00.180Z", 0.51, 0.505, 0.92),
        gaze("2026-01-01T00:00:00.260Z", 0.515, 0.51, 0.91),
    ]
    summary = compute_quality_summary(events, detect_fixations(events))

    assert summary["quality_verdict"] == "pass"
    assert summary["calibration_points_completed"] == 5
    assert summary["average_gaze_confidence"] == 0.91


def test_rich_synthetic_session_produces_fixations_and_populated_aoi_metrics() -> None:
    events = rich_synthetic_events()
    fixations = detect_fixations(events)
    primary_cta = AoiRecord(
        id=DEMO_STUDY_ID,
        study_id=DEMO_STUDY_ID,
        label="Primary CTA",
        page_url=None,
        x=0.52,
        y=0.38,
        width=0.2,
        height=0.12,
        coordinate_space="normalized",
        created_at="2026-01-01T00:00:00.000Z",
    )

    metrics = compute_aoi_metrics([primary_cta], events, fixations=fixations, task_start_timestamp=events[0].timestamp)

    assert len(fixations) >= 4
    assert summarize_fixations(fixations)["fixation_count"] >= 4
    assert metrics[0].gaze_sample_count == 8
    assert metrics[0].fixation_count == 1
    assert metrics[0].fixation_dwell_ms > 0
    assert metrics[0].time_to_first_fixation_ms is not None
    assert metrics[0].average_fixation_confidence == 0.9


def test_rich_synthetic_quality_modes_warn_or_fail() -> None:
    low_confidence_events = rich_synthetic_events("low_confidence")
    bad_calibration_events = rich_synthetic_events("bad_calibration")
    no_gaze_events = rich_synthetic_events("no_gaze")

    low_confidence_summary = compute_quality_summary(low_confidence_events, detect_fixations(low_confidence_events))
    bad_calibration_summary = compute_quality_summary(bad_calibration_events, detect_fixations(bad_calibration_events))
    no_gaze_summary = compute_quality_summary(no_gaze_events, detect_fixations(no_gaze_events))

    assert low_confidence_summary["quality_verdict"] == "warn"
    assert "Low-confidence gaze sample rate is above 35%." in low_confidence_summary["quality_reasons"]
    assert bad_calibration_summary["quality_verdict"] == "fail"
    assert no_gaze_summary["quality_verdict"] == "fail"
    assert no_gaze_summary["quality_reasons"] == ["No accepted gaze events are present."]


def test_timestamp_parser_accepts_iso_seconds_and_milliseconds() -> None:
    iso = parse_event_timestamp("2026-01-01T00:00:00.000Z")
    seconds = parse_event_timestamp(1767225600)
    milliseconds = parse_event_timestamp(1767225600000)

    assert iso is not None
    assert seconds is not None
    assert milliseconds is not None
    assert seconds == milliseconds
