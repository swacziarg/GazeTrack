# AGENTS.md

## Project mission
Build **GazeTrack** into a production-style, privacy-first, task-based webcam gaze analytics platform for website builders. Prioritize reliable telemetry modeling, quality-aware analytics, and clear reporting over flashy but low-trust demos.

## Coding standards
- Prefer TypeScript on frontend and typed Python on backend.
- Keep functions small, composable, and testable.
- Use explicit schema/contracts for API payloads and events.
- Avoid dead code and speculative abstractions.
- Keep PRs focused and minimal.

## Architectural principles
- Web-first and browser-native gaze estimation.
- Clear separation: capture -> ingest -> validate -> aggregate -> report.
- Design for multi-tenant/team support from day one in schema.
- Treat tracking quality as a first-class signal, not an afterthought.
- Favor append-only event logs for telemetry and derived analytics tables for reporting.

## Product constraints
- Do not position as medical-grade eye tracking.
- Do not claim perfect gaze accuracy.
- Do not use PyGaze as core; prefer browser-compatible approaches (e.g., WebGazer.js).
- Do not store raw webcam video.
- Keep MVP focused on task-based study analytics, not generic session recording.

## Privacy rules
- Webcam processing should remain local in-browser where possible.
- Persist only telemetry needed for UX analysis.
- Store confidence/quality metadata with events and sessions.
- Minimize PII and apply least-privilege access patterns.
- Support retention/deletion workflows in future iterations.

## What not to build
- A generic Hotjar clone without task context.
- Medical or biometric identity claims.
- Heavy auth/permissions systems in initial pass (document only unless required).
- Over-engineered distributed infrastructure before MVP validation.

## Data modeling conventions
- Use UUID primary keys.
- Include `created_at` and `updated_at` timestamps on mutable entities.
- Use `captured_at` for client event time and `ingested_at` for server receive time.
- Prefer normalized core entities + denormalized reporting tables/materialized views.
- Version event schemas when breaking changes occur.

## Frontend conventions
- React + TypeScript + Vite baseline.
- Organize by feature where possible (`studies`, `sessions`, `reports`).
- Keep tracking integration isolated in service/hooks layer.
- Surface calibration/quality states prominently in UI.
- Avoid hidden magic thresholds; expose key quality indicators.

## Backend conventions
- FastAPI routes grouped by domain (`studies`, `sessions`, `events`, `reports`).
- Pydantic models for request/response validation.
- Service layer handles business logic; API layer remains thin.
- Database access through clearly scoped repository/query modules.
- Background analytics jobs compute derived metrics and report artifacts.

## Testing expectations
- Unit test metric computation and quality score logic.
- Integration test ingestion endpoints and schema validation.
- Add lightweight end-to-end happy path once frontend/backend skeleton exists.
- Validate privacy constraints (e.g., no video payload persistence).

## How agents should make changes
- Make the smallest change that fully solves the requested task.
- Read surrounding code/docs before editing.
- Preserve project positioning and privacy constraints.
- Do not add dependencies unless justified.
- Update relevant docs when behavior/contracts change.

## Commit/PR guidance
- Use focused commits with clear intent.
- Summarize user-visible impact and data model/API changes.
- Call out risks, assumptions, and follow-ups.
- Include validation evidence (tests/manual checks) in PR notes.

## Terminology glossary
- **AOI (Area of Interest):** Named region on a page used for attention metrics.
- **Fixation:** Short period where gaze remains within a small spatial threshold.
- **TTFF:** Time to first fixation for a target AOI.
- **CAF delay:** Time between first fixation on AOI and subsequent click.
- **Session quality score:** Composite score from calibration error, confidence, and sample integrity.
- **Study:** Research configuration containing page(s), task(s), and AOIs.
- **Tester session:** One participant run through calibration + task execution.
