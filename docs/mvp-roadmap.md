# MVP Roadmap

## `v0.1-demo` completed baseline

GazeTrack now has a credible local full-stack demo shape:

- React/Vite/TypeScript dashboard with a synthetic study/session/report flow
- Default synthetic tracker with multiple quality modes
- Feature-flagged `WebGazerTracker` spike behind `VITE_ENABLE_WEBGAZER`, consent, and guarded `window.webgazer` access
- FastAPI + SQLite persistence for studies, tasks, AOIs, sessions, accepted telemetry events, and persisted reports
- Privacy validation that rejects media-like payload keys before persistence
- Backend report helpers for event counts, AOI hit metrics, bounded raw dwell, `simple_dispersion_v1` demo fixations, TTFF from task start, quality verdicts, and replay payloads
- Frontend local report, backend ingest/report panels, synthetic visuals, and schematic normalized-coordinate replay
- Backend tests, frontend tests, and frontend production build covering the current demo surface

## Release definition

`v0.1-demo` is a synthetic-first portfolio/demo release. It should be tagged only as a privacy-first synthetic telemetry demo pipeline for task-based UX testing, not as production webcam eye tracking.

The release can mention the browser gaze spike only as experimental, feature-flagged, unbundled, consent-gated, and not production-ready.

## Remaining release-confidence tests

These are the two main blockers before calling the tag polished rather than just functional:

1. Add Playwright or similar E2E happy path with the backend running.
2. Validate actual backend report responses against `contracts/session-report.schema.json`.

## Next milestones

### 1. Release hardening

- Add E2E happy path covering frontend demo completion, backend ingest, and backend report fetch.
- Validate backend report responses against the JSON schema contract.
- Expand nested media-key rejection tests if coverage is not exhaustive.
- Add database reset/seed instructions.
- Ensure `backend/gazetrack_demo.db` is treated as local state, not a release artifact.

### 2. Product narrative polish

- Tighten frontend copy around synthetic mode and the experimental browser gaze mode.
- Add screenshots/GIF and deterministic demo instructions.
- Keep README, product spec, backend/frontend READMEs, metrics docs, and interview story aligned on synthetic-first language.

### 3. Metrics evolution

- Either implement backend CAF delay with tests and contract updates or keep it out of MVP claims.
- Keep entropy, dispersion, and production heatmap generation documented as future metrics until they are returned by the backend.
- Keep fixation logic labeled as `simple_dispersion_v1` demo analytics until validated against real browser gaze input.

### 4. Future production path

- Evaluate a bundled browser gaze implementation only after consent, privacy, accuracy, and browser compatibility risks are documented.
- Add production-quality calibration gates and quality thresholds.
- Add auth, retention/deletion workflows, deployment hardening, export/share features, and multi-session reporting only when they are part of the implemented scope.
