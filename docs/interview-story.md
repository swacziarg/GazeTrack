# Interview Story: GazeTrack

## Why I built it
I wanted to combine full-stack product engineering with event modeling and analytics, close to real product/data work. GazeTrack turns my analytics background into a privacy-first synthetic telemetry demo pipeline for task-based UX studies.

## Technical decisions
- Made synthetic telemetry the default so the demo is safe, deterministic, and credible without webcam access.
- Kept a browser-native gaze spike behind `VITE_ENABLE_WEBGAZER`, explicit consent, and guarded `window.webgazer` access for future exploration.
- Split architecture into capture, ingestion, analytics, and reporting layers for maintainability.
- Modeled append-only telemetry plus persisted report payloads to mirror production analytics stacks.

## Tradeoffs
- The current release demonstrates pipeline shape with synthetic data, not production webcam gaze accuracy.
- Browser gaze is noisier than dedicated hardware; quality scoring is mandatory before any future production tracker claim.
- Prioritized trustworthy metrics and uncertainty communication over flashy but fragile features.
- Deferred complex auth/permissions to keep MVP focused on core study/report loop.

## Data quality challenges
- Calibration variability across lighting/devices for future browser gaze work.
- Coordinate drift with scrolling/responsive layouts.
- Separating true fixations from jitter/noise once real tracker input is validated.
- Handling missing or low-confidence samples without misleading results.

## Privacy decisions
- Keep synthetic mode camera-free.
- Process webcam frames locally in-browser if future browser gaze work requires camera access.
- Store telemetry only (coordinates/events/confidence), never raw video.
- Reject media-like payload keys before persistence.
- Treat data minimization and transparent confidence reporting as product features.

## Validation approach
- Ingestion is covered by contract/integration tests in the backend suite.
- Metrics are checked on deterministic sample sessions with expected outputs.
- Session quality bands are compared against known-good/known-poor synthetic quality modes.
- The current repo includes a Playwright synthetic happy path and backend report schema validation test; re-run them locally before relying on validation status.

## What went wrong / likely risks
- Browser/device variability may reduce consistency.
- Metric thresholds may need iterative tuning to avoid false confidence.
- Schematic replay performance can degrade for high-volume sessions.
- Product copy must keep experimental browser gaze separate from the current synthetic demo.

## Role alignment narrative
- **Data engineering:** Event schema design, ingestion reliability, derived metrics pipelines.
- **Product analytics:** Task funnel metrics, AOI attention metrics, quality-aware interpretation.
- **Internal tools/full-stack:** Study setup, researcher dashboard panels, schematic replay/report UX.

## Project impact bullets
- Built a privacy-first synthetic UX telemetry demo capturing **[X]+ events/session** across gaze-like, click, scroll, calibration, and task streams.
- Designed SQLite-backed event/report persistence with a documented PostgreSQL/Supabase schema direction.
- Implemented synthetic calibration, quality modes, confidence-aware report verdicts, AOI attention ranking, TTFF, attention share, and CAF-style click-after-fixation insights across React/FastAPI.
- Delivered an end-to-end React/FastAPI demo from study setup to backend-generated report and schematic replay in **[N] weeks**.
