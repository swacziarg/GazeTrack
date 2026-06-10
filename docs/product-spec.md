# Product Spec: GazeTrack

## Current Positioning

For Release 003, GazeTrack is a privacy-first task analytics MVP for website builders. It combines a camera-free synthetic demo path with a controlled-site Website Integration MVP that captures interaction telemetry, AOI snapshots, and quality-aware reports without storing raw media.

Do not describe the product as production webcam eye tracking, medical-grade tracking, biometric identity, or a generic session recorder. Browser gaze estimation is optional, experimental, approximate, and quality-gated.

## Problem Statement

Website builders often know what users clicked, but have less structured context about attention before action. GazeTrack explores a task-based telemetry model that can tie gaze-like samples, clicks, scrolls, calibration quality, AOI visibility, and task outcomes to explicit study goals while keeping privacy constraints visible.

## Current Release 003 Implementation

- React/Vite/TypeScript dashboard with study setup, synthetic run flow, backend report panel, and Website integration helper.
- Default synthetic tracker and deterministic five-point calibration/session flow.
- Quality modes for `healthy`, `low_confidence`, `bad_calibration`, and `no_gaze`.
- Standalone controlled-site SDK served at `/sdk/v0.2/gazetrack-capture.js`, with legacy `/gazetrack-capture.js` compatibility.
- Dedicated `/api/v1/capture/...` public capture namespace.
- Capture token support, token rotation, and per-study `allowed_origins`.
- Idempotent capture ingest with SDK-generated `batch_id` and `client_event_id`.
- Reliable SDK flushing with periodic flush, lifecycle flush, retry/backoff, queue retention until acknowledgement, and final flush before completion.
- Privacy-safe real-site layout snapshots with arbitrary DOM text off by default, optional selector-allowed text, redaction selectors, and CSS metadata controls.
- FastAPI + SQLite persistence for studies, tasks, AOIs, tester sessions, AOI snapshots, accepted telemetry events, and report payloads.
- Manual AOI configuration with normalized rectangles and real-site selector/role-key snapshots.
- Event ingestion with schema validation and recursive rejection of media-like payload keys.
- Backend report helpers for event counts, AOI gaze/click hit metrics, bounded raw dwell, `simple_dispersion_v1` demo fixations, TTFF from task start, CAF-style click-after-fixation delay, quality-aware AOI insight summaries, heuristic quality verdicts, privacy summary, and schematic replay payloads.

## Website Integration Workflow

1. Create or configure a study with a target URL, task prompt, AOIs, and optional `allowed_origins`.
2. Copy the dashboard Website integration snippet or call the local/demo-admin install verification endpoint.
3. Install the snippet on a controlled website using `/sdk/v0.2/gazetrack-capture.js`.
4. Run an interaction-only task by default. The SDK creates a capture session, snapshots configured AOIs, queues events, flushes retry-safely, and completes the session after final flush.
5. Review a backend report built from accepted telemetry, AOI snapshots, and computed metrics.

## Experimental Browser Gaze

- `WebGazerTracker` remains behind `VITE_ENABLE_WEBGAZER` in the dashboard and `enableWebGazer: true` in the real-site SDK.
- Browser gaze requires explicit tester action/consent before initialization.
- WebGazer is not bundled by the dashboard default path.
- This path does not establish production real gaze tracking.
- Compatible browser gaze telemetry must remain privacy-safe: coordinates, timestamps, confidence/quality metadata, calibration/task/click/scroll events, and no raw media.

## Current Non-Goals

- Production-grade webcam tracking.
- Medical-grade eye tracking or biometric identity claims.
- Raw video, image, screenshot, frame, blob, or base64 persistence.
- Real heatmaps or screenshot/page replay.
- Generic session-recording/Hotjar clone behavior.
- Authentication/authorization.
- Deployment, export, or shareable report features.
- Remote crawling or install scanning of target websites.

## Release 004 Product Directions

- Authenticated dashboard/admin controls for snippet config, install verification, and capture token rotation.
- Retention/deletion workflows and auditable tester consent records.
- Multi-session study summaries and variant comparison.
- Stronger task success metrics and clearer reporting across repeated sessions.
- DOM/selector-assisted AOI authoring that avoids screenshots and media persistence.
- Browser gaze quality validation before promoting any real-gaze capability beyond experimental status.
- Export/share flows after access control and privacy review.

## User Personas

1. **Indie Website Builder:** Wants quick, task-based feedback on whether a key page flow is understandable.
2. **UX Researcher:** Wants structured study runs with explicit task context and quality indicators.
3. **Product Analyst:** Wants event contracts and derived metrics that can grow into a trustworthy reporting pipeline.

## Current Workflows

Synthetic workflow:

1. Open the demo study.
2. Review seeded task and normalized AOIs.
3. Run synthetic calibration.
4. Run a synthetic task session.
5. Ingest accepted telemetry into the FastAPI backend.
6. Review local and backend-generated demo reports.
7. Inspect schematic normalized-coordinate replay when backend replay data exists.

Website integration workflow:

1. Configure study target URL, task, AOIs, token, and optional allowed origins.
2. Install the versioned SDK snippet on a controlled website.
3. Capture interaction telemetry and optional experimental WebGazer telemetry with explicit consent/configuration.
4. Generate quality-aware reports from accepted telemetry and AOI snapshots.

## UX Principles

- Clearly label synthetic data, experimental tracker paths, and unsupported features.
- Surface calibration confidence and data quality prominently.
- Make reports interpretable by non-experts.
- Prioritize defensible metrics over novelty visuals.
- Keep privacy constraints visible in setup, telemetry, and report surfaces.
- Make website integration repeatable with copyable snippets, explicit AOI selector lists, and clear troubleshooting guidance.

## Product Differentiation Target

- Task-based analytics, not passive recordings alone.
- Interaction telemetry plus optional gaze-like telemetry in one explicit event model.
- First-class session quality/confidence scoring.
- Privacy-first architecture that avoids raw media storage.
- Public capture boundary shaped for future PostgreSQL/Supabase and authenticated admin migration.
