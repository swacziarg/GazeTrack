# Analytics Metrics Definitions

## Dwell time by AOI
**Plain English:** Total time a tester spent looking at each AOI.
**Compute:** Map gaze samples and fixation centroids to normalized AOI rectangles. Current reports keep `approximate_dwell_ms` from bounded raw gaze-sample gaps and add `fixation_dwell_ms` from detected fixation durations.

`fixation_dwell_ms` is usually more meaningful than raw sample dwell because it ignores isolated samples and requires a small cluster over time. It is still approximate in the current demo because the input is synthetic-compatible browser telemetry, not calibrated production gaze tracking.

## Time to first fixation (TTFF)
**Plain English:** How long it took from task start until the tester first clearly looked at a target AOI.
**Compute:** `first_fixation_timestamp_on_target_aoi - task_start_timestamp`.

## Fixation count
**Plain English:** Number of distinct fixations during a session (or per AOI).
**Compute:** Current backend reports use `simple_dispersion_v1`, a deterministic normalized-coordinate clustering helper. It sorts accepted gaze samples by timestamp, skips missing/unusable coordinates, skips very low confidence samples when confidence exists, groups consecutive samples below a normalized radius threshold and timestamp gap, then requires at least three samples and at least 100 ms duration.

This is demo-grade HCI telemetry, not medical-grade fixation detection.

## Click-after-fixation delay
**Plain English:** Delay between first fixation on target AOI and first relevant click.
**Compute:** `first_click_timestamp_on_target - first_fixation_timestamp_on_target`.

## Task completion time
**Plain English:** Total time to complete the assigned task.
**Compute:** `task_completed_timestamp - task_started_timestamp`.

## Gaze dispersion
**Plain English:** How spread out visual attention was across the page.
**Compute:** Spatial variance (or RMS distance from centroid) of fixation coordinates over session or task window.

## Attention entropy
**Plain English:** How concentrated vs. scattered attention was across AOIs.
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
**Compute:** Project gaze/fixation points to normalized page coordinates, apply Gaussian kernel density estimation, render intensity grid.

## Replay data format
**Plain English:** Time-ordered stream used to replay gaze and interactions.
**Compute/Format:** Store JSON timeline with `{t, type, payload}` events (gaze/click/scroll/task) and metadata (viewport, quality flags) for deterministic playback.
