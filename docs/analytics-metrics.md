# Analytics Metrics Definitions

## Dwell time by AOI
**Plain English:** Total time a tester spent looking at each AOI.
**Compute:** Map gaze/fixation samples to AOIs by geometry overlap; sum fixation durations per AOI.

## Time to first fixation (TTFF)
**Plain English:** How long it took from task start until the tester first clearly looked at a target AOI.
**Compute:** `first_fixation_timestamp_on_target_aoi - task_start_timestamp`.

## Fixation count
**Plain English:** Number of distinct fixations during a session (or per AOI).
**Compute:** Cluster gaze points by spatial threshold + minimum duration; count resulting fixation windows.

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
**Compute:** Weighted composite of calibration error, low-confidence rate, valid sample rate, and tracking gaps. Normalize to 0-100.

## Calibration error
**Plain English:** Average prediction error during calibration targets.
**Compute:** Pixel distance between known target point and predicted gaze point; report mean and p95.

## Low-confidence sample rate
**Plain English:** Fraction of gaze samples below confidence threshold.
**Compute:** `count(confidence < threshold) / total_gaze_samples`.

## Heatmap generation method
**Plain English:** Visual density map of where users looked most.
**Compute:** Project gaze/fixation points to normalized page coordinates, apply Gaussian kernel density estimation, render intensity grid.

## Replay data format
**Plain English:** Time-ordered stream used to replay gaze and interactions.
**Compute/Format:** Store JSON timeline with `{t, type, payload}` events (gaze/click/scroll/task) and metadata (viewport, quality flags) for deterministic playback.
