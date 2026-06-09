# API Contracts

These contracts describe the currently implemented backend demo API and SQLite-backed local telemetry flow.

## Routes

- `GET /health` → `{ "status": "ok" }`
- `GET /api/v1/meta` → project metadata + privacy posture + implemented capabilities
- `POST /api/v1/studies` → accepts `name`, optional `objective`, optional `target_url`, optional `allowed_origins`; returns generated `study_id`
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
- `GET /api/v1/capture/config?study_id=...&capture_token=...` → returns public capture task/AOI config for a token-authorized study
- `POST /api/v1/capture/sessions` → creates a token-authorized real-site capture session
- `POST /api/v1/capture/sessions/{session_id}/aoi-snapshots` → replaces session AOI snapshots for the captured page
- `POST /api/v1/capture/sessions/{session_id}/events` → ingests token-authorized real-site capture telemetry
- `POST /api/v1/capture/sessions/{session_id}/complete` → completes a token-authorized real-site capture session
- `GET /api/v1/studies/{study_id}/install-verification` → local/demo-admin install readiness helper with the current versioned snippet, target URL, AOI selectors, and allowed origins
- `POST /api/v1/studies/{study_id}/capture-token/rotate` → local/demo-admin route that replaces the study capture token and returns the current snippet config

Legacy dashboard/demo endpoints remain available for local development and synthetic telemetry compatibility. New website embeds should use the `/api/v1/capture/...` namespace through the versioned SDK.

## Public capture API

The public capture API is the boundary used by `gazetrack-capture.js`. These endpoints require the study capture token and return `403` for an invalid token. When a study has `allowed_origins`, capture requests must also include a browser `Origin` header that exactly matches one configured origin. Empty allowlists preserve current local/demo behavior. The token and origin check are not user-auth substitutes; until auth exists, token retrieval endpoints are local/demo-admin surfaces.

Study create/configuration payloads support `allowed_origins`:

```json
{
  "name": "Checkout CTA study",
  "objective": "Measure whether visitors notice checkout.",
  "target_url": "https://example.test/pricing",
  "allowed_origins": ["https://example.test"]
}
```

Origins must include `http` or `https` scheme and host, with no path, query, or fragment. Values are normalized and stored as JSON text in SQLite. Global CORS still controls browser access to the backend; the per-study allowlist is an additional app-level validation step for the public capture namespace.

Fetch capture config:

```http
GET /api/v1/capture/config?study_id={study_id}&capture_token={capture_token}
```

Response shape is `CaptureConfigResponse`:

```json
{
  "study_id": "00000000-0000-0000-0000-000000000000",
  "name": "Checkout CTA study",
  "objective": "Measure whether visitors notice checkout.",
  "target_url": "https://example.test/pricing",
  "task_prompt": "Find checkout.",
  "aois": [
    {
      "aoi_id": "00000000-0000-0000-0000-000000000001",
      "label": "Primary CTA",
      "semantic_type": "CTA",
      "role_key": "primary_cta",
      "selector": "[data-gazetrack-aoi='primary_cta']",
      "required": true
    }
  ]
}
```

Create a capture session:

```http
POST /api/v1/capture/sessions
```

```json
{
  "study_id": "00000000-0000-0000-0000-000000000000",
  "capture_token": "capture-token-from-snippet-config",
  "page_url": "https://example.test/pricing",
  "viewport_width": 1440,
  "viewport_height": 900,
  "document_width": 1440,
  "document_height": 1800
}
```

Response shape is `SessionResponse` with `session_id`, `study_id`, `status`, and `persistence`.

Submit AOI snapshots:

```http
POST /api/v1/capture/sessions/{session_id}/aoi-snapshots
```

```json
{
  "capture_token": "capture-token-from-snippet-config",
  "snapshots": [
    {
      "source_aoi_id": "00000000-0000-0000-0000-000000000001",
      "label": "Primary CTA",
      "semantic_type": "CTA",
      "role_key": "primary_cta",
      "selector": "[data-gazetrack-aoi='primary_cta']",
      "page_url": "https://example.test/pricing",
      "x": 0.1,
      "y": 0.2,
      "width": 0.2,
      "height": 0.1,
      "coordinate_space": "document_normalized",
      "detected": true
    }
  ]
}
```

Response shape is a list of `AoiSnapshotResponse` rows. Coordinates are normalized document rectangles.

Submit capture events:

```http
POST /api/v1/capture/sessions/{session_id}/events
```

```json
{
  "capture_token": "capture-token-from-snippet-config",
  "batch_id": "batch_opaque-random-id",
  "events": [
    {
      "event_type": "task_start",
      "timestamp": "2026-01-01T00:00:00Z",
      "client_event_id": "evt_opaque-random-id",
      "payload": {
        "source": "real_site_capture",
        "tracker_type": "real_site_capture",
        "page_url": "https://example.test/pricing"
      }
    }
  ]
}
```

`batch_id` and `client_event_id` are optional opaque delivery IDs. The capture SDK sends one `batch_id` per flush and one `client_event_id` per event so retries can be idempotent. The backend enforces uniqueness for `(session_id, client_event_id)` when `client_event_id` is present. Synthetic/demo ingest may omit these IDs and remains append-only.

Response shape is `EventIngestResponse` with `accepted_count`, `rejected_count`, `duplicate_count`, `skipped_count`, `stored_count_for_session`, and `rejected_reasons`. `accepted_count` means validation-accepted events in the request, including duplicate retry events. `duplicate_count`/`skipped_count` identify accepted events that were not persisted again because the session already stored the same `client_event_id`. Media-like payload keys are rejected and not persisted.

Complete a capture session:

```http
POST /api/v1/capture/sessions/{session_id}/complete
```

```json
{
  "capture_token": "capture-token-from-snippet-config"
}
```

Response shape is `SessionCompleteResponse` with `completed: true` and the accepted event count.

### Install verification helper

Local/demo-admin callers can fetch a study's website integration readiness payload:

```http
GET /api/v1/studies/{study_id}/install-verification
```

Response shape:

```json
{
  "study_id": "00000000-0000-0000-0000-000000000000",
  "expected_script_path": "/sdk/v0.2/gazetrack-capture.js",
  "expected_script_url": "https://your-gazetrack-api.example/sdk/v0.2/gazetrack-capture.js",
  "capture_token_exists": true,
  "target_url": "https://example.test/pricing",
  "allowed_origins": ["https://example.test"],
  "aois": [
    {
      "aoi_id": "00000000-0000-0000-0000-000000000001",
      "label": "Primary CTA",
      "semantic_type": "CTA",
      "role_key": "primary_cta",
      "selector": "[data-gazetrack-aoi='primary_cta']",
      "required": true
    }
  ],
  "recommended_snippet": "<script>...</script>"
}
```

The helper ensures a capture token exists and returns a copyable snippet using `/sdk/v0.2/gazetrack-capture.js`. It is not a remote scanner: it does not crawl, fetch, screenshot, or inspect the target website. Because dashboard authentication is not implemented yet, treat this route and the visible snippet/token panel as local/demo-admin only.

### Capture token rotation

Local/demo-admin callers can rotate a study capture token:

```http
POST /api/v1/studies/{study_id}/capture-token/rotate
```

The response shape is `CaptureSnippetConfigResponse`: the current study/task/AOI snippet config plus the newly generated `capture_token`. The previous token stops working immediately for public capture config, session creation, event ingest, AOI snapshots, and completion. `GET /api/v1/studies/{study_id}/capture-snippet-config` returns the current token after rotation.

This is the current revoke posture for Release 003: rotate the token, update or redeploy the controlled-site snippet, and old embedded tokens are rejected. Authentication is not implemented yet, so token retrieval and rotation endpoints must be treated as local/demo-admin APIs, not public end-user APIs.

### SDK privacy options

`window.GazeTrackConfig` supports these layout privacy options for real-site capture:

```js
window.GazeTrackConfig = {
  apiBaseUrl: 'https://your-gazetrack-api.example',
  studyId: '00000000-0000-0000-0000-000000000000',
  captureToken: 'capture-token-from-snippet-config',
  captureText: false,
  captureCssMetadata: true,
  allowedTextSelectors: ['[data-gazetrack-allow-text]'],
  redactSelectors: ['[data-gazetrack-redact]', 'form']
}
```

- `captureText` defaults to `false`. By default, `layout_snapshot.landmarks` stores structural metadata such as tag, semantic type, bounding boxes, CSS metadata, and configured AOI labels, but not arbitrary paragraph, heading, link, or button text.
- `captureCssMetadata` defaults to `true`. Set it to `false` to omit color/font metadata from captured layout landmarks.
- `allowedTextSelectors` is only used when `captureText: true`. Text is captured only for elements matching or contained by these selectors.
- `redactSelectors` always win over allowed selectors. Inputs, textareas, and password fields never contribute text, placeholder, value, or aria text.
- AOI labels may appear in layout snapshots and reports because they are configured by the study owner, not read from arbitrary page copy.
- These options do not allow raw webcam video, frames, screenshots, image blobs, base64 media, face embeddings, or face landmarks.

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
- `coordinate_space` (`normalized` or `document_normalized`)

Each `replay_events` item includes a narrow privacy-safe shape:

- `id`
- `type`
- `timestamp`
- `relative_ms`
- optional normalized or document-normalized `x`/`y`
- optional `confidence`
- `aoi_ids`
- optional `label`
- optional `message`
- optional `source`

`replay_fixations` includes computed fixation points with `id`, `type: "fixation"`, start/end timestamps, start/end relative time, `duration_ms`, normalized or document-normalized `x`/`y`, `sample_count`, optional `average_confidence`, and `aoi_ids`.

`replay_aoi_overlay` includes normalized or document-normalized AOI rectangles with `id`, `label`, `x`, `y`, `width`, `height`, and `coordinate_space`.

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
