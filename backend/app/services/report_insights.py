"""Quality-aware UX report insight helpers."""

from __future__ import annotations

from typing import Any

from app.models.api import (
    AoiAttentionRankingItemResponse,
    AoiInsightResponse,
    AoiMetricResponse,
    QualityInterpretationResponse,
)


def _aoi_insight(metric: AoiMetricResponse) -> AoiInsightResponse:
    return AoiInsightResponse(
        aoi_id=metric.aoi_id,
        label=metric.label,
        dwell_time_ms=metric.dwell_time_ms,
        fixation_count=metric.fixation_count,
        time_to_first_fixation_ms=metric.time_to_first_fixation_ms,
        click_count=metric.click_count,
        click_after_fixation_ms=metric.click_after_fixation_ms,
        attention_share_pct=metric.attention_share_pct,
    )


def quality_interpretation(quality_summary: dict[str, Any]) -> QualityInterpretationResponse:
    verdict = quality_summary.get("quality_verdict")
    reasons = quality_summary.get("quality_reasons")
    reason_text = " ".join(str(reason) for reason in reasons) if isinstance(reasons, list) else ""

    if verdict == "pass":
        return QualityInterpretationResponse(
            label="Usable",
            explanation=(
                "Quality signals appear sufficient for directional, task-based AOI interpretation in this demo session."
            ),
        )

    if verdict == "warn":
        return QualityInterpretationResponse(
            label="Use with caution",
            explanation=(
                "Some quality signals are weak, so treat AOI patterns as directional rather than precise. "
                f"{reason_text}".strip()
            ),
        )

    return QualityInterpretationResponse(
        label="Limited",
        explanation=(
            "Interpretation is limited because accepted gaze quality is weak or missing. "
            f"{reason_text}".strip()
        ),
    )


def aoi_attention_ranking(metrics: list[AoiMetricResponse]) -> list[AoiAttentionRankingItemResponse]:
    ranked_metrics = sorted(
        metrics,
        key=lambda metric: (
            metric.dwell_time_ms,
            metric.fixation_count,
            metric.click_count,
            metric.gaze_sample_count,
            metric.label.lower(),
        ),
        reverse=True,
    )

    ranking: list[AoiAttentionRankingItemResponse] = []
    for index, metric in enumerate(ranked_metrics, start=1):
        ranking.append(
            AoiAttentionRankingItemResponse(
                **_aoi_insight(metric).model_dump(),
                rank=index,
                attention_score=round(
                    metric.dwell_time_ms + metric.fixation_count * 100 + metric.click_count * 75,
                    1,
                ),
            )
        )
    return ranking


def first_noticed_aoi(metrics: list[AoiMetricResponse]) -> AoiInsightResponse | None:
    noticed = [metric for metric in metrics if metric.time_to_first_fixation_ms is not None]
    if not noticed:
        return None
    return _aoi_insight(
        min(
            noticed,
            key=lambda metric: (
                metric.time_to_first_fixation_ms if metric.time_to_first_fixation_ms is not None else 10**12,
                metric.label.lower(),
            ),
        )
    )


def most_attended_aoi(ranking: list[AoiAttentionRankingItemResponse]) -> AoiInsightResponse | None:
    if not ranking:
        return None
    top = ranking[0]
    if top.dwell_time_ms <= 0 and top.fixation_count <= 0 and top.click_count <= 0:
        return None
    return AoiInsightResponse(**top.model_dump(exclude={"rank", "attention_score"}))


def weak_or_ignored_aois(metrics: list[AoiMetricResponse]) -> list[AoiInsightResponse]:
    return [
        _aoi_insight(metric)
        for metric in metrics
        if metric.fixation_count == 0 or metric.attention_share_pct < 10
    ]


def report_summary(
    event_count: int,
    quality: QualityInterpretationResponse,
    first_noticed: AoiInsightResponse | None,
    most_attended: AoiInsightResponse | None,
    weak_aois: list[AoiInsightResponse],
) -> list[str]:
    summary = [
        f"Report generated from {event_count} accepted telemetry events; no raw webcam media is stored.",
        f"Quality interpretation: {quality.label}. {quality.explanation}",
    ]
    if first_noticed is not None:
        summary.append(f"First noticed AOI appears to be {first_noticed.label}.")
    if most_attended is not None:
        summary.append(
            f"Most attended AOI appears to be {most_attended.label} at {most_attended.attention_share_pct:.1f}% of AOI dwell."
        )
    elif weak_aois:
        summary.append("AOI attention is weak or inconclusive in this session.")
    return summary[:4]


def recommended_next_actions(
    quality: QualityInterpretationResponse,
    first_noticed: AoiInsightResponse | None,
    most_attended: AoiInsightResponse | None,
    weak_aois: list[AoiInsightResponse],
    tracker_experimental: bool,
) -> list[str]:
    actions: list[str] = []

    if quality.label == "Limited":
        actions.append("Rerun the task with stronger calibration before making design decisions from this session.")
    elif quality.label == "Use with caution":
        actions.append("Use this run as directional evidence and confirm the pattern with another higher-quality session.")

    if most_attended is not None:
        actions.append(
            f"Compare attention on {most_attended.label} with the task objective to confirm it supports the intended user action."
        )

    if first_noticed is not None and first_noticed.click_after_fixation_ms is not None:
        actions.append(
            f"Review the {first_noticed.label} path after first fixation; click-after-fixation was {first_noticed.click_after_fixation_ms} ms."
        )

    if weak_aois:
        labels = ", ".join(aoi.label for aoi in weak_aois[:2])
        actions.append(f"Consider improving visibility, placement, or copy for weak-attention AOIs: {labels}.")

    if tracker_experimental:
        actions.append("For browser gaze experiments, validate findings with synthetic replay or additional sessions before presenting them as evidence.")

    if not actions:
        actions.append("Run one or two additional task sessions to check whether the AOI attention pattern repeats.")

    return actions[:4]
