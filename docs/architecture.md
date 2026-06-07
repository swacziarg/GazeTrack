# Architecture Overview: GazeTrack

## System overview
GazeTrack is a full-stack web system where browser clients capture gaze + interaction telemetry, backend APIs ingest and validate events, and analytics jobs compute quality-aware metrics for reporting.

## Frontend/backend/database boundaries
- **Frontend (React/TS):** Study setup UI, calibration UI, telemetry capture, report rendering.
- **Backend (FastAPI):** Auth-ready API surface, study/session/event endpoints, report orchestration.
- **Database (PostgreSQL/Supabase):** Core entities, append-only event tables, derived metrics/report tables.

## Event ingestion flow
1. Frontend opens/creates tester session.
2. Client buffers gaze and interaction events with timestamps/confidence.
3. Batched events sent to ingestion endpoint.
4. Backend validates schema/session linkage and writes to event tables.
5. Analytics job queue marks affected session/report for recomputation.

## Gaze tracking flow
1. Browser initializes WebGazer.js (or equivalent).
2. Gaze samples captured at periodic intervals with confidence + viewport coordinates.
3. Samples transformed into normalized page coordinates.
4. Stored as gaze telemetry (no raw frames/video persisted).

## Calibration flow
1. Present calibration targets across viewport.
2. Capture prediction error metrics per point.
3. Compute aggregate calibration error + confidence bands.
4. Store calibration metrics and gate session start if below threshold.

## Analytics/reporting flow
1. Derive fixations from raw gaze samples.
2. Join fixations to AOIs and task events.
3. Compute per-session/per-AOI metrics.
4. Compute session quality score.
5. Materialize report payload for dashboard rendering.

## Privacy model
- Webcam image processing local to browser where feasible.
- Persist telemetry only (coordinates, confidence, events, quality metadata).
- Avoid sensitive fields unless necessary for study operation.
- Plan for retention/deletion controls and auditability.

## Deployment model
- Local-first dev setup for frontend + backend + Postgres.
- Future deploy path: frontend static hosting + FastAPI service + managed Postgres/Supabase.
- Optional background worker process for periodic analytics recompute.

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
