# MVP Roadmap

This document describes the current Release 003 implementation state and likely next milestones. It is not a release-readiness statement; re-run validation in the current checkout before publishing.

## Current Release 003 State

The repository contains a local full-stack UX telemetry MVP:

- React/Vite/TypeScript dashboard with study setup, synthetic session flow, report display, and Website integration helper.
- Default synthetic tracker with deterministic calibration, gaze-like samples, clicks, scrolls, and task events.
- Controlled-site capture SDK served from `/sdk/v0.2/gazetrack-capture.js`, with legacy `/gazetrack-capture.js` compatibility.
- Dedicated `/api/v1/capture/...` namespace for public website capture config, session creation, AOI snapshots, event ingest, and completion.
- Capture tokens, token rotation, and per-study `allowed_origins` checks for public capture requests.
- Retry-safe event delivery with `batch_id`, `client_event_id`, duplicate skipping, periodic flush, lifecycle flush, and final flush before completion.
- Privacy-safe real-site layout capture with arbitrary DOM text off by default, optional selector-allowed text, redaction selectors, and CSS metadata controls.
- Optional WebGazer experiment behind explicit configuration and consent. It remains approximate, browser-dependent, and not medical-grade.
- FastAPI + SQLite persistence for studies, tasks, AOIs, sessions, accepted telemetry events, AOI snapshots, and persisted reports.
- Backend report helpers for event counts, AOI hit metrics, bounded raw dwell, `simple_dispersion_v1` demo fixations, TTFF from task start, CAF-style click-after-fixation delay, quality-aware AOI insights, and schematic replay payloads.

## Validation Evidence

Validation evidence is local and time-scoped. Re-run the relevant commands before relying on status:

```bash
git status --short
cd backend && PYTHONPATH=. pytest
cd ../frontend && npm test
npm run build
npm run e2e
```

Release 003 validation is tracked in [release-003-checklist.md](release-003-checklist.md). Historical `v0.1-demo` notes remain in [v0.1-demo-release-checklist.md](v0.1-demo-release-checklist.md).

## Known Non-Goals

- Medical-grade eye tracking, biometric identity, or perfect gaze accuracy claims.
- Raw webcam video, frames, screenshots, images, blobs, base64 media, face embeddings, or face landmarks.
- Generic session recording or Hotjar-style passive replay.
- Authenticated dashboard/admin access control.
- Remote crawling, scanner-style install verification, or target-site screenshot capture.
- Production analytics jobs, background workers, exports, share links, retention UI, or team permissions.

## Release 004 Candidates

- Authenticated local/admin boundaries for snippet config, install verification, and token rotation.
- Retention/deletion workflows and clearer tester consent records before any production data collection.
- Multi-session study summaries, segment comparisons, and stronger task-success metrics.
- More explicit AOI authoring assistance that uses DOM/selector data without storing screenshots or page media.
- Broader privacy regression tests for layout snapshots, lifecycle flush payloads, and token/origin enforcement.
- Export/share flows only after least-privilege access controls exist.
- Browser gaze quality validation before promoting any real-gaze capability beyond experimental status.
