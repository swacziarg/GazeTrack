# Architecture Overview: GazeTrack

## System overview
GazeTrack is currently a full-stack synthetic telemetry demo where the browser emits synthetic gaze-like + interaction telemetry, backend APIs ingest and validate privacy-safe events, and report helpers/services compute quality-aware demo metrics for reporting. Future browser gaze work is isolated behind an experimental feature flag.

## Frontend/backend/database boundaries
- **Frontend (React/TS):** Study setup UI, calibration UI, telemetry capture, report rendering.
- **Backend (FastAPI):** Study/task/AOI/session/event endpoints and report orchestration. Authentication is not implemented in the current demo.
- **Database:** SQLite for current local development; schema is shaped for a later PostgreSQL/Supabase migration with core entities, task/AOI setup tables, append-only event tables, and persisted report payloads.

## Event ingestion flow
1. Frontend opens/creates tester session.
2. Client buffers gaze and interaction events with timestamps/confidence.
3. Batched events sent to ingestion endpoint.
4. Backend validates schema/session linkage and writes accepted privacy-safe events to SQLite.
5. Report generation reads persisted events plus study tasks/AOIs and writes a report payload row.

## Study setup flow
1. A study contains task prompts and AOI rectangles.
2. Tasks capture `title`, `prompt`, optional `success_criteria`, and optional `target_url`.
3. AOIs capture `label`, optional `page_url`, normalized `x`, `y`, `width`, `height`, and `coordinate_space`.
4. The default synthetic demo study is seeded with one task and five placeholder AOIs when no setup exists.

AOI coordinates are normalized 0-1 rectangles. They are currently demo placeholders; screenshot uploads and DOM-based AOI detection are not part of this milestone.

## Gaze tracking flow
1. Frontend tracker providers implement a shared boundary for calibration, session start/stop, and telemetry events.
2. The default `SyntheticTracker` emits rich synthetic gaze samples clustered around known AOIs, with normalized `x`/`y`, confidence, calibration, scroll, click, and task events.
3. The optional `WebGazerTracker` spike is hidden unless `VITE_ENABLE_WEBGAZER=true`, requires explicit consent before initialization, and uses guarded `window.webgazer` access.
4. Backend report helpers normalize compatible event points into 0-1 coordinates.
5. Stored telemetry must remain coordinates, confidence/quality metadata, events, and timestamps only; no raw frames/video/images/screenshots/blobs/base64 payloads are persisted or returned in replay.

## Calibration flow
1. Current frontend renders five calibration target dots through the selected tracker flow.
2. Synthetic mode emits target/observed/error telemetry per point and an aggregate calibration summary without camera access.
3. Browser gaze experiment mode records calibration target events only after consent and adapter initialization.
4. Backend quality helpers read calibration error + confidence fields for report verdicts.
5. Future tracker work can improve browser-native calibration while keeping raw frames/video out of persistence.

## Analytics/reporting flow
1. Read accepted telemetry events for a session.
2. Normalize compatible gaze/click payload coordinates into 0-1 page coordinates.
3. Detect demo-grade fixation candidates from accepted gaze samples.
4. Join gaze/click event points and fixation centroids to AOI rectangles.
5. Compute per-session/per-AOI demo metrics and heuristic quality verdicts.
6. Build schematic replay data from accepted telemetry, computed fixations, and normalized AOI boxes.
7. Materialize report payload for dashboard rendering.

Current local reports compute deterministic event counts, gaze presence, low-confidence gaze rate, click/scroll/calibration/task counts, task/AOI counts, AOI gaze sample counts, AOI click counts, approximate raw-sample AOI dwell, fixation-derived AOI dwell, report-level fixation summary, replay summary/events/fixations/AOI overlay, privacy summary, and a heuristic quality summary from stored telemetry.

The fixation detector is `simple_dispersion_v1`: accepted gaze samples with normalized coordinates are sorted by timestamp, clustered when consecutive samples are close in space and time, and promoted to a fixation only after minimum sample-count and duration thresholds. This is a deterministic demo pipeline for future browser gaze input, not medical-grade eye tracking or a claim of perfect gaze accuracy.

AOI dwell still includes the earlier bounded-gap raw-sample approximation from gaze timestamps inside a region. Fixation-derived dwell is a stronger attention signal than raw sample dwell, but remains approximate because the current input is synthetic-compatible telemetry rather than calibrated production webcam tracking.

Calibration/session quality is also heuristic. The backend summarizes calibration event count, calibration points completed when provided, average calibration error, average gaze confidence, low-confidence rate, sample completeness, and a `pass`/`warn`/`fail` verdict with reasons. The synthetic generator exposes `healthy`, `low_confidence`, `bad_calibration`, and `no_gaze` modes to exercise those verdicts without camera access.

Session replay v1 is a privacy-safe schematic overlay. The backend emits ordered replay events, fixation centroids, summary counts, and normalized AOI rectangles. The frontend renders those as SVG AOI boxes, gaze samples, fixation markers, click markers, textual task/scroll/calibration markers, and a deterministic scrubber. This is not video replay, screenshot playback, or a production replay engine.

## Privacy model
- Webcam image processing local to browser where feasible.
- Persist telemetry only (coordinates, confidence, events, quality metadata).
- Generate replay from persisted telemetry and computed fixations only.
- Reject raw webcam/video/image/frame/base64/blob payloads before persistence.
- Keep browser gaze tracking feature-flagged and consent-gated; synthetic telemetry remains the default.
- Avoid sensitive fields unless necessary for study operation.
- Plan for retention/deletion controls and auditability.

## Local and possible deployment model
- Local-first dev setup for frontend + backend + SQLite.
- Possible future deploy path: frontend static hosting + FastAPI service + managed Postgres/Supabase.
- Optional future background worker process for periodic analytics recompute.

## Suggested folder structure
```text
frontend/
backend/
  app/
    api/
    models/
    services/
    analytics/
    db/
docs/
scripts/
sample-data/
```

## Key technical risks
- Browser gaze quality variance across lighting/devices.
- Coordinate drift with responsive layouts and scroll changes.
- Event volume growth for gaze sampling rates.
- Distinguishing true fixations from noisy sample clusters.
- Communicating uncertainty without reducing product trust.
