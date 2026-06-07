# Event and Report Data Flow

This document traces the implemented demo flow from study setup to report display.

## 1. Study setup

The frontend loads or saves a study configuration with:

- Study name.
- Objective.
- Target URL or page label.
- Task prompts.
- AOIs as normalized 0-1 rectangles.
- Optional semantic AOI types.

The backend persists these records in SQLite tables for studies, tasks, and AOIs.

## 2. Capture source

The frontend tracker boundary supports two sources:

- `synthetic`: default deterministic demo telemetry with no camera permission.
- `webgazer_experimental`: optional browser gaze telemetry behind feature flag, consent, and browser support.

Both sources emit compatible event envelopes. Browser gaze events must stay privacy-safe and may not include raw media.

## 3. Contract mapping

Frontend telemetry is mapped into backend event types such as:

- `task_start`
- `calibration`
- `gaze`
- `click`
- `scroll`
- `task_complete`
- `quality`

Payloads can include coordinates, timestamps, confidence, calibration metadata, task context, and tracker source.

## 4. Ingest validation

`POST /api/v1/sessions/{session_id}/events` accepts a single event or an event batch.

The backend:

1. Validates event shape.
2. Checks session linkage.
3. Recursively rejects media-like payload keys such as video, frame, image, blob, base64, and webcam frame.
4. Stores accepted events in append-only SQLite telemetry rows.
5. Returns accepted, rejected, and stored counts.

Rejected media-like payloads are not persisted.

## 5. Report generation

`GET /api/v1/sessions/{session_id}/report` reads persisted study setup and telemetry, then computes:

- Event counts and event type counts.
- Gaze presence and low-confidence sample rate.
- Session quality score and verdict.
- Calibration summary.
- AOI gaze/click metrics.
- Approximate raw-sample dwell.
- Demo fixation clusters with `simple_dispersion_v1`.
- Fixation-derived AOI dwell.
- TTFF from task start.
- Privacy summary.
- Schematic replay events, fixation points, and AOI overlays.

The report payload is persisted for local demo review.

## 6. Frontend report display

The frontend renders:

- Local demo metrics from current session state.
- Ingest status from FastAPI.
- Backend report fields generated from SQLite.
- AOI breakdown.
- Quality and calibration reasons.
- Schematic normalized-coordinate replay.

The replay is not video replay, screenshot playback, or a production session recorder. It is generated from accepted telemetry and computed fixation centroids.

## Current boundaries

- Synthetic mode remains the default.
- Browser gaze remains experimental.
- Reports are quality-aware but demo-grade.
- No raw webcam media is sent, stored, or returned.
- No production auth, teams, exports, or retention/deletion workflow exists yet.
