# Analytics Metrics Definitions

These definitions distinguish current `v0.1-demo` report fields from future production metrics. Current inputs are synthetic-compatible telemetry and optional experimental browser-gaze-shaped events, not validated production webcam tracking.

## Dwell time by AOI
**Plain English:** Total time a tester spent looking at each AOI.
**Compute:** Map gaze samples and fixation centroids to normalized AOI rectangles. Current reports keep `approximate_dwell_ms` from bounded raw gaze-sample gaps and add `fixation_dwell_ms` from detected fixation durations.

`fixation_dwell_ms` is usually more meaningful than raw sample dwell because it ignores isolated samples and requires a small cluster over time. It is still approximate in the current demo because the input is synthetic-compatible browser telemetry, not calibrated production gaze tracking.

## Time to first fixation (TTFF)
**Plain English:** How long it took from task start until the tester first clearly looked at a target AOI.
**Current status:** Implemented in backend AOI metrics as `time_to_first_fixation_ms` when a task start and fixation inside the AOI are available.
**Compute:** `first_fixation_timestamp_on_target_aoi - task_start_timestamp`.

## Fixation count
**Plain English:** Number of distinct fixations during a session (or per AOI).
**Compute:** Current backend reports use `simple_dispersion_v1`, a deterministic normalized-coordinate clustering helper. It sorts accepted gaze samples by timestamp, skips missing/unusable coordinates, skips very low confidence samples when confidence exists, groups consecutive samples below a normalized radius threshold and timestamp gap, then requires at least three samples and at least 100 ms duration.

This is demo-grade HCI telemetry, not medical-grade fixation detection.

## Click-after-fixation delay
**Plain English:** Delay between first fixation on target AOI and first relevant click.
**Current status:** Implemented in backend AOI metrics as `click_after_fixation_ms` when a fixation and later click are both available inside the same AOI. It is a demo CAF-style heuristic, not validated clinical gaze analysis.
**Compute:** `first_later_click_timestamp_on_target_aoi - first_fixation_timestamp_on_target_aoi`.

## Task completion time
**Plain English:** Total time to complete the assigned task.
**Current status:** Future reporting metric. Task start/complete events exist, but the current backend report does not expose a dedicated task completion time field.
**Compute:** `task_completed_timestamp - task_started_timestamp`.

## Gaze dispersion
**Plain English:** How spread out visual attention was across the page.
**Current status:** Future metric. The current fixation algorithm is named `simple_dispersion_v1`, but the report does not return a session-level dispersion score.
**Compute:** Spatial variance (or RMS distance from centroid) of fixation coordinates over session or task window.

## Attention entropy
**Plain English:** How concentrated vs. scattered attention was across AOIs.
**Current status:** Future metric. Not returned by the `v0.1-demo` backend report.
**Compute:** Build AOI dwell-time distribution `p_i`; entropy `H = -sum(p_i * ln(p_i))`.

## Session quality score
**Plain English:** Overall reliability score for the session's gaze data.
**Compute:** Current reports include a heuristic score plus `quality_verdict` (`pass`, `warn`, `fail`) and `quality_reasons`. Inputs include accepted gaze-event presence, average gaze confidence, low-confidence sample rate, calibration event count, calibration points completed when provided, calibration error when provided, sample completeness, and whether fixation candidates were detected.

## Calibration error
**Plain English:** Average prediction error during calibration targets.
**Compute:** Pixel or normalized distance between known target point and predicted gaze point when the client provides it. Current backend parsing is defensive and supports synthetic fields such as `calibration_error_px`, `calibration_error_normalized`, and `calibration_points_completed`.

## Low-confidence sample rate
**Plain English:** Fraction of gaze samples below confidence threshold.
**Compute:** `count(confidence < threshold) / total_gaze_samples`.

## Heatmap generation method
**Plain English:** Visual density map of where users looked most.
**Current status:** Future production feature. The frontend has synthetic visual previews only; backend reports do not return a real heatmap payload.
**Compute:** Project gaze/fixation points to normalized page coordinates, apply Gaussian kernel density estimation, render intensity grid.

## Replay data format
**Plain English:** Time-ordered stream used to replay gaze and interactions.
**Compute/Format:** Current reports return a narrow replay payload, not raw event payloads. `replay_summary` gives counts, duration, and `coordinate_space: "normalized"`. `replay_events` is ordered by relative time and includes event type, timestamp, `relative_ms`, optional normalized `x`/`y`, optional confidence, AOI hits, label/message, and source. `replay_fixations` includes computed fixation centroids with start/end relative time, duration, sample count, optional confidence, and AOI hits. `replay_aoi_overlay` includes normalized AOI rectangles.

Replay v1 is a schematic SVG visualization over normalized coordinates. It does not use video, screenshots, images, blobs, base64 media, or a production session replay engine.
