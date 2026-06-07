# Event Taxonomy (placeholder)

Allowed event types for telemetry ingestion:

- `gaze` (may include normalized `x`/`y`, `point: { x, y }`, pixel `x`/`y` with `viewport_width`/`viewport_height`, `confidence`)
- `click` (may include the same coordinate shapes as `gaze`)
- `scroll`
- `task_start`
- `task_complete`
- `calibration`
- `quality`
- `page_view`

Tracker sources may set `payload.source` to `"synthetic"` or `"webgazer"`. Both sources use the same privacy-safe
event envelope. A browser gaze event should look like:

```json
{
  "event_type": "gaze",
  "timestamp": "2026-01-01T00:00:00Z",
  "payload": {
    "source": "webgazer",
    "x": 0.52,
    "y": 0.41,
    "viewport_width": 1440,
    "viewport_height": 900,
    "confidence": null
  }
}
```

AOI report metrics use accepted `gaze` and `click` events with compatible coordinates. If `x` and `y` are already between 0 and 1, they are treated as normalized. If coordinates are pixel values, `viewport_width` and `viewport_height` are required so the backend can normalize them.

AOIs are normalized 0-1 rectangles. Demo reports count gaze/click events inside those rectangles and compute approximate raw-sample dwell from bounded timestamp gaps.

Reports also run `simple_dispersion_v1` fixation detection over accepted `gaze` events. The detector supports normalized `payload.x`/`payload.y`, normalized `payload.point.x`/`payload.point.y`, and pixel coordinates with viewport dimensions. Samples with missing coordinates, unparsable timestamps, or very low confidence are skipped. Consecutive samples are grouped when they are close in normalized space and time, then emitted as fixation candidates only when minimum sample-count and duration thresholds are met.

Fixation-derived AOI metrics use the fixation centroid: a fixation belongs to an AOI when its centroid is inside the normalized rectangle. Fixation dwell is more meaningful than raw sample dwell but remains approximate and demo-grade.

Calibration and quality events may include `confidence`, `calibration_error_px`, `calibration_error_normalized`, and `calibration_points_completed`. Synthetic per-target calibration events may also include:

- `target_point: { "x": 0.5, "y": 0.5 }`
- `observed_point: { "x": 0.51, "y": 0.49 }`
- `error_px`
- `error_normalized`
- `calibration_step`
- `calibration_point_count`

The default frontend calibration UI is synthetic: it renders five target dots and generates telemetry without requesting camera permission. The optional WebGazer/browser tracker spike is hidden unless `VITE_ENABLE_WEBGAZER=true`, requires explicit consent before initialization, emits `webgazer_experimental` telemetry only, and remains approximate browser gaze estimation, not medical-grade eye tracking or a biometric assessment.

Privacy rule: events must not contain raw media fields, webcam frame content, images, screenshots, blobs, or base64 media.
