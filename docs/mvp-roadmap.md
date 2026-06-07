# MVP Roadmap

This document describes the current documented implementation state and possible future directions. It is not a release-readiness statement or a prioritized execution plan.

## Current documented state

The current repository contains a local full-stack synthetic demo path:

- React/Vite/TypeScript dashboard with a synthetic study/session/report flow
- Default synthetic tracker with multiple quality modes
- Feature-flagged `WebGazerTracker` spike behind `VITE_ENABLE_WEBGAZER`, consent, and guarded `window.webgazer` access
- FastAPI + SQLite persistence for studies, tasks, AOIs, sessions, accepted telemetry events, and persisted reports
- Privacy validation that rejects media-like payload keys before persistence
- Backend report helpers for event counts, AOI hit metrics, bounded raw dwell, `simple_dispersion_v1` demo fixations, TTFF from task start, CAF-style click-after-fixation delay, quality-aware AOI insights, and replay payloads
- Frontend local report, backend ingest/report panels, synthetic visuals, and schematic normalized-coordinate replay

The repository currently has a `v0.1-demo` Git tag, verified with `git tag --list` on 2026-06-07. Confirm tag state in the current checkout before publishing or relying on release notes.

## Validation evidence

Validation evidence is local and time-scoped. Re-run the relevant commands in the current environment before relying on test status:

```bash
git tag --list "v0.1-demo"
git status --short
cd backend && PYTHONPATH=. pytest
cd ../frontend && npm test
npm run build
npm run e2e
```

See [v0.1-demo Validation Notes](v0.1-demo-release-checklist.md) for recorded local validation details.

## Known non-goals and not currently claimed

- Production webcam tracking
- Medical-grade eye tracking
- Real heatmaps
- Screenshot or video replay
- DOM-derived AOI detection
- Authentication, deployment, export, or sharing features
- Multi-session analytics

## Possible future directions

- Configurable study setup beyond the seeded demo study
- Stronger privacy regression tests, including broader recursive media-key rejection cases
- Database reset/seed documentation
- Multi-session reporting and comparison views
- Metrics evolution for task completion time, entropy, dispersion, and heatmap generation after backend support exists
- Browser gaze research mode with documented consent, privacy, accuracy, and browser-compatibility evidence
- Production hardening candidates such as auth, retention/deletion workflows, deployment, export, and sharing after those areas enter implemented scope
