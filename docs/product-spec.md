# Product Spec: GazeTrack

## Current positioning

For `v0.1-demo`, GazeTrack is a privacy-first synthetic telemetry demo pipeline for task-based website UX testing. It demonstrates how a credible product/data system can model study setup, telemetry ingestion, quality-aware analytics, and reporting without storing raw webcam media.

Do not describe the current demo as production webcam eye tracking. Browser gaze estimation is experimental and future-facing.

## Problem statement

Website builders often know what users clicked, but have less structured context about attention before action. GazeTrack explores a task-based telemetry model that can tie gaze-like samples, clicks, scrolls, calibration quality, and task outcomes to explicit study goals while keeping privacy constraints visible.

## Current `v0.1-demo` implementation

- React/Vite/TypeScript demo dashboard
- Default synthetic tracker and synthetic five-point calibration/session flow
- Quality modes for `healthy`, `low_confidence`, `bad_calibration`, and `no_gaze`
- FastAPI + SQLite persistence for studies, tasks, AOIs, tester sessions, accepted telemetry events, and report payloads
- Manual/demo AOIs stored as normalized 0-1 rectangles
- Event ingestion endpoint with schema validation and recursive rejection of media-like payload keys
- Backend report helpers for event counts, AOI gaze/click hit metrics, bounded raw dwell, `simple_dispersion_v1` demo fixations, TTFF from task start, heuristic quality verdicts, privacy summary, and schematic replay payloads
- Frontend local report, backend ingest/report panels, synthetic visual previews, and normalized-coordinate schematic replay

## Experimental implementation

- `WebGazerTracker` exists behind `VITE_ENABLE_WEBGAZER`
- The browser gaze option is hidden by default, requires explicit consent, and guards against missing `window.webgazer`
- WebGazer is not bundled
- This path does not establish production real gaze tracking and is described only as a browser gaze spike
- Compatible browser gaze telemetry must remain privacy-safe: coordinates, timestamps, confidence/quality metadata, calibration/task/click/scroll events, and no raw media

## Current non-goals

- Production-grade webcam tracking
- Medical-grade eye tracking or biometric identity claims
- Raw video, image, screenshot, frame, blob, or base64 persistence
- Real heatmaps or screenshot/page replay
- DOM-derived AOI detection
- CAF delay in implemented report claims
- Authentication/authorization
- Deployment, export, or shareable report features
- Generic session-recording/Hotjar clone behavior

## Possible future product directions

The long-term product can evolve toward a real browser-native gaze analytics platform, but these items remain possible directions unless implementation and validation evidence is added:

- Production browser gaze integration and calibration quality gates
- Webcam permission flow for real tracker mode, with consent and local frame processing
- Study creation/editing beyond the seeded demo flow
- DOM-assisted or screenshot-assisted AOI authoring
- Production fixation analytics, heatmap generation, and report exports
- CAF delay and additional attention metrics once backend support exists
- Multi-session study summaries and variant comparison
- Team/auth model, retention/deletion workflows, and deployment hardening
- Shareable report snapshots after access control and privacy review

## User personas

1. **Indie Website Builder:** Wants quick, task-based feedback on whether a key page flow is understandable.
2. **UX Researcher:** Wants structured study runs with explicit task context and quality indicators.
3. **Product Analyst:** Wants event contracts and derived metrics that can grow into a trustworthy reporting pipeline.

## Current demo workflow

1. Open the demo study.
2. Review seeded task and normalized AOIs.
3. Run synthetic calibration.
4. Run a synthetic task session.
5. Ingest accepted telemetry into the FastAPI backend.
6. Review local and backend-generated demo reports.
7. Inspect schematic normalized-coordinate replay when backend replay data exists.

## Possible future workflow

1. Create a study with page/task setup.
2. Define AOIs manually or with future page/DOM assistance.
3. Run tester through consent, camera permission, calibration, and task execution.
4. Ingest gaze + interaction events with confidence metadata.
5. Generate quality-aware reports with metrics validated for the implemented tracker mode.

## UX principles

- Clearly label synthetic data, experimental tracker paths, and unsupported features.
- Surface calibration confidence and data quality prominently.
- Make reports interpretable by non-experts.
- Prioritize defensible metrics over novelty visuals.
- Keep privacy constraints visible in setup, telemetry, and report surfaces.

## Product differentiation target

- Task-based analytics, not passive recordings alone
- Gaze-like telemetry + interaction telemetry in one explicit event model
- First-class session quality/confidence scoring
- Privacy-first architecture that avoids raw media storage
