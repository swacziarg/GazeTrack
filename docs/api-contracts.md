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

The frontend now routes telemetry through tracker providers. `SyntheticTracker` remains the default source. A guarded
`WebGazerTracker` spike can be exposed locally with `VITE_ENABLE_WEBGAZER=true`, but it requires explicit consent before
initialization and uses the same backend event envelope. Browser tracker payloads may include
`source: "webgazer_experimental"`, `tracker_type: "webgazer_experimental"`, normalized `x`/`y`, viewport dimensions,
optional confidence, calibration/task fields, and timestamps. They must not include video, frames, images, screenshots,
blobs, or base64 media.

The frontend-only browser gaze debug UI may show a local approximate gaze dot, tracker state, sample counts, elapsed
capture time, weak-signal messages, and calibration feedback (`good`, `usable`, or `weak`). These are operator-facing
debug signals. Backend ingest still receives only the existing privacy-safe telemetry event envelope. Calibration
summary payloads may include `calibration_quality`, `calibration_recommendation`, `camera_readiness_score`, and a
privacy-safe `camera_readiness_baseline`; gaze samples may include `quality_score`, `quality_flags`,
`tracking_quality`, and `drift_metrics`. Direct face box, eye visibility, and approximate head-pose setup checks are
computed locally; raw face landmarks and biometric identity data are not part of the ingest contract. Reports continue to label
`tracker_type: "webgazer_experimental"` sessions as experimental and not medical-grade.

`GET /api/v1/sessions/{session_id}/report` includes:

- `analytics_version`
- `event_count`
- `event_type_counts`
- `first_event_timestamp`
- `last_event_timestamp`
- `contains_gaze_events`
- `low_confidence_sample_rate`
- `session_quality_score`
- `tracker_type`
- `tracker_mode_label`
- `tracker_experimental`
- `tracker_notice`
- `task_count`
- `aoi_count`
- `has_aoi_metrics`
- `aoi_metrics`
- `report_summary`
- `quality_interpretation`
- `aoi_attention_ranking`
- `first_noticed_aoi`
- `most_attended_aoi`
- `weak_or_ignored_aois`
- `recommended_next_actions`
- `fixation_summary`
- `privacy_summary`
- `quality_summary`
- `replay_summary`
- `replay_events`
- `replay_fixations`
- `replay_aoi_overlay`
- `insights`

Each `aoi_metrics` item includes:

- `aoi_id`
- `label`
- `page_url`
- `coordinate_space`
- `gaze_sample_count`
- `first_gaze_timestamp`
- `approximate_dwell_ms`
- `dwell_time_ms`
- `click_count_inside_aoi`
- `click_count`
- `fixation_count`
- `fixation_dwell_ms`
- `first_fixation_timestamp`
- `time_to_first_fixation_ms`
- `click_after_fixation_ms`
- `attention_share_pct`
- `average_fixation_confidence`

`approximate_dwell_ms` is a demo estimate. The backend sums bounded gaps up to 500 ms between gaze samples inside the AOI, with a deterministic fallback of `gaze_sample_count * 100 ms` when timestamps are missing or unparsable. It is not real fixation detection. `dwell_time_ms` uses fixation dwell when available and falls back to approximate dwell so ranking remains deterministic.

Fixation-derived fields are computed from accepted gaze events at report generation time; no separate fixation table is stored yet. A fixation belongs to an AOI when its normalized centroid falls inside the AOI rectangle.

Quality-aware insight fields are deterministic heuristics:

- `report_summary`: 2-4 concise bullets for what happened and how much to trust it.
- `quality_interpretation`: label (`Usable`, `Use with caution`, or `Limited`) plus a cautious explanation.
- `aoi_attention_ranking`: AOIs sorted by attention strength from dwell, fixations, clicks, and gaze samples.
- `first_noticed_aoi`: earliest AOI with a detected fixation when determinable.
- `most_attended_aoi`: top ranked AOI when there is usable AOI signal.
- `weak_or_ignored_aois`: AOIs with zero fixations or less than 10% AOI attention share.
- `recommended_next_actions`: 2-4 grounded suggestions, with limited-interpretation warnings for weak quality.

`click_after_fixation_ms` is the delay from first detected fixation in an AOI to the first later click inside that AOI when both signals exist. It is a demo CAF-style heuristic, not validated clinical gaze analysis.

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
- `calibration_readiness_score`
- `tracking_quality_counts` and `tracking_quality_percentages`
- `drift_warning_count`
- `quality_flag_counts` and `major_quality_flags`
- `sample_completeness_score`
- `quality_verdict` (`pass`, `warn`, or `fail`)
- `quality_reasons`

Quality verdicts are heuristic. They fail when no accepted gaze events exist or calibration error is clearly too high, warn on high low-confidence rate or zero detected fixations despite gaze samples, and pass when synthetic-compatible gaze confidence and calibration signals are acceptable.

Calibration payloads are accepted as JSON telemetry. Per-target synthetic calibration events may include `target_point`, `observed_point`, `error_px`, `error_normalized`, `calibration_step`, and `calibration_point_count`; aggregate calibration events may include `calibration_error_px`, `calibration_error_normalized`, and `calibration_points_completed`.

Replay fields are generated from persisted telemetry and computed fixations only. They are intended for a schematic normalized-coordinate visualization, not video replay or screenshot playback.

`replay_summary` includes:

- `event_count`
- `gaze_event_count`
- `fixation_count`
- `click_count`
- `scroll_count`
- `task_event_count`
- `duration_ms`
- `coordinate_space` (`normalized`)

Each `replay_events` item includes a narrow privacy-safe shape:

- `id`
- `type`
- `timestamp`
- `relative_ms`
- optional normalized `x`/`y`
- optional `confidence`
- `aoi_ids`
- optional `label`
- optional `message`
- optional `source`

`replay_fixations` includes computed fixation points with `id`, `type: "fixation"`, start/end timestamps, start/end relative time, `duration_ms`, normalized `x`/`y`, `sample_count`, optional `average_confidence`, and `aoi_ids`.

`replay_aoi_overlay` includes normalized AOI rectangles with `id`, `label`, `x`, `y`, `width`, `height`, and `coordinate_space`.

Replay responses do not include raw event payloads wholesale. They must not include webcam video, frames, images, screenshots, blobs, base64 media, or other raw media-like fields.

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

No auth, production-grade webcam tracking, bundled WebGazer dependency, screenshot uploads, production analytics jobs, production replay engine, medical-grade fixation detection, or raw media storage is implemented in this phase.
