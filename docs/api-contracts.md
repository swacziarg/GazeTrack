# API Contracts

These contracts describe the currently implemented backend demo API and SQLite-backed local telemetry flow.

## Routes

- `GET /health` → `{ "status": "ok" }`
- `GET /api/v1/meta` → project metadata + privacy posture + implemented capabilities
- `POST /api/v1/studies` → accepts `name`, optional `objective`, optional `target_url`; returns generated `study_id`
- `GET /api/v1/studies` → lists persisted local studies, including the synthetic demo study once initialized
- `GET /api/v1/studies/{study_id}` → returns a persisted study envelope
- `POST /api/v1/studies/{study_id}/tasks` → creates a task with `title`, `prompt`, optional `success_criteria`, optional `target_url`
- `GET /api/v1/studies/{study_id}/tasks` → lists persisted tasks for the study
- `POST /api/v1/studies/{study_id}/aois` → creates an AOI with `label`, optional `page_url`, normalized `x`, `y`, `width`, `height`
- `GET /api/v1/studies/{study_id}/aois` → lists persisted AOIs for the study
- `POST /api/v1/studies/{study_id}/sessions` → returns generated `session_id`
- `POST /api/v1/sessions/{session_id}/events` → accepts single event or `{ "events": [...] }`; validates event shape, rejects media-like payload keys, and stores accepted telemetry in SQLite
- `POST /api/v1/sessions/{session_id}/complete` → marks the demo session complete in SQLite and returns `event_count`
- `GET /api/v1/sessions/{session_id}/report` → returns and persists a backend-generated demo report from stored synthetic telemetry

## Task contract

Task create payload:

```json
{
  "title": "Find the main call to action",
  "prompt": "Explore the landing page and click the primary call-to-action when you find it.",
  "success_criteria": "User identifies and clicks the primary CTA.",
  "target_url": "https://example.test/pricing"
}
```

Task responses include `task_id`, `study_id`, `title`, `prompt`, `success_criteria`, `target_url`, and `created_at`.

## AOI contract

AOI create payload:

```json
{
  "label": "Primary CTA",
  "page_url": "https://example.test/pricing",
  "x": 0.52,
  "y": 0.38,
  "width": 0.2,
  "height": 0.12,
  "coordinate_space": "normalized"
}
```

AOIs are normalized 0-1 rectangles. `x` and `y` are top-left coordinates, and `width`/`height` are normalized dimensions. An event with normalized coordinates is inside an AOI when:

- `x >= aoi.x`
- `x <= aoi.x + aoi.width`
- `y >= aoi.y`
- `y <= aoi.y + aoi.height`

Current AOIs are manual/demo placeholders only. Screenshot uploads and DOM-derived AOI detection are not implemented.

## Demo report fields

The current frontend demo posts rich synthetic telemetry only. A healthy run includes task start/complete events, five synthetic calibration target events plus a calibration summary, 30-80 clustered gaze samples, at least one scroll, and a click inside the `Primary CTA` AOI. `low_confidence`, `bad_calibration`, and `no_gaze` modes are used to exercise quality verdicts. None of these modes request webcam permission or send raw media.

`GET /api/v1/sessions/{session_id}/report` includes:

- `analytics_version`
- `event_count`
- `event_type_counts`
- `first_event_timestamp`
- `last_event_timestamp`
- `contains_gaze_events`
- `low_confidence_sample_rate`
- `session_quality_score`
- `task_count`
- `aoi_count`
- `has_aoi_metrics`
- `aoi_metrics`
- `fixation_summary`
- `privacy_summary`
- `quality_summary`
- `insights`

Each `aoi_metrics` item includes:

- `aoi_id`
- `label`
- `page_url`
- `coordinate_space`
- `gaze_sample_count`
- `first_gaze_timestamp`
- `approximate_dwell_ms`
- `click_count_inside_aoi`
- `fixation_count`
- `fixation_dwell_ms`
- `first_fixation_timestamp`
- `time_to_first_fixation_ms`
- `average_fixation_confidence`

`approximate_dwell_ms` is a demo estimate. The backend sums bounded gaps up to 500 ms between gaze samples inside the AOI, with a deterministic fallback of `gaze_sample_count * 100 ms` when timestamps are missing or unparsable. It is not real fixation detection.

Fixation-derived fields are computed from accepted gaze events at report generation time; no separate fixation table is stored yet. A fixation belongs to an AOI when its normalized centroid falls inside the AOI rectangle.

`fixation_summary` includes:

- `fixation_count`
- `total_fixation_dwell_ms`
- `average_fixation_duration_ms`
- `average_fixation_confidence` when confidence is available
- `fixation_algorithm`
- `fixation_algorithm_notes`

Current `fixation_algorithm` is `simple_dispersion_v1`. It clusters accepted normalized gaze samples by spatial radius and timestamp gap, then requires a minimum sample count and duration. This is deterministic, demo-grade analytics, not medical-grade eye tracking or a guarantee of perfect gaze accuracy.

`quality_summary` includes the previous score and low-confidence fields plus:

- `calibration_points_completed`
- `average_calibration_error_normalized`
- `average_gaze_confidence`
- `sample_completeness_score`
- `quality_verdict` (`pass`, `warn`, or `fail`)
- `quality_reasons`

Quality verdicts are heuristic. They fail when no accepted gaze events exist or calibration error is clearly too high, warn on high low-confidence rate or zero detected fixations despite gaze samples, and pass when synthetic-compatible gaze confidence and calibration signals are acceptable.

Calibration payloads are accepted as JSON telemetry. Per-target synthetic calibration events may include `target_point`, `observed_point`, `error_px`, `error_normalized`, `calibration_step`, and `calibration_point_count`; aggregate calibration events may include `calibration_error_px`, `calibration_error_normalized`, and `calibration_points_completed`.

## Event types currently allowed

- `gaze`
- `click`
- `scroll`
- `task_start`
- `task_complete`
- `calibration`
- `quality`
- `page_view`

## Privacy constraints

Event payloads containing keys that look like raw media are rejected (case-insensitive):

- `video`
- `frame`
- `image`
- `base64`
- `blob`
- `webcam_frame`

Accepted telemetry is stored in local SQLite by default. Rejected media-like payloads are not persisted. The current schema uses UUID/string IDs, timestamp columns, append-only telemetry rows, and JSON payloads serialized as text to keep a straightforward future migration path to PostgreSQL/Supabase.

No auth, webcam tracking, WebGazer integration, screenshot uploads, production analytics jobs, medical-grade fixation detection, or raw media storage is implemented in this phase.
