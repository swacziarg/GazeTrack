# GazeTrack

GazeTrack is a privacy-first, task-based UX analytics demo for website builders. It shows how a browser frontend, typed telemetry contracts, a FastAPI ingest layer, SQLite persistence, and backend-generated reports can work together to evaluate whether users notice and act on important page regions. The recommended demo uses deterministic synthetic telemetry; the optional browser gaze path is experimental, opt-in, approximate, and not medical-grade eye tracking.

## What is implemented now

- React + TypeScript + Vite dashboard for study setup, demo session flow, telemetry status, and reports.
- Configurable synthetic study setup with study name, objective, target URL/label, task prompts, and normalized AOIs.
- Default `SyntheticTracker` with deterministic calibration, gaze, click, scroll, and task events.
- Synthetic quality modes: `healthy`, `low_confidence`, `bad_calibration`, and `no_gaze`.
- Optional `WebGazerTracker` experiment hidden behind `VITE_ENABLE_WEBGAZER=true`, consent, and browser support checks.
- FastAPI + SQLite persistence for studies, tasks, AOIs, tester sessions, accepted telemetry events, and report payloads.
- Privacy-safe ingest validation that rejects media-like payload keys before persistence.
- Backend reports with event counts, AOI hit metrics, approximate dwell, demo fixation detection, TTFF, quality verdicts, privacy summary, and schematic replay data.
- In-app Demo Guide for reviewers and placeholders/instructions for future screenshots or GIFs.

## Synthetic mode quickstart

Synthetic mode is the default and the recommended portfolio/demo path. It does not request webcam permission.

1. Configure environment:

   ```bash
   cp .env.example .env
   ```

2. Start the backend:

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   PYTHONPATH=. uvicorn app.main:app --reload
   ```

3. Start the frontend in a second terminal:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Open `http://localhost:5173`, click `Open demo study`, keep `Synthetic demo` selected, run calibration, complete the session, and inspect the backend report.

SQLite demo data is stored locally in `backend/gazetrack_demo.db` unless `GAZETRACK_DATABASE_URL` or `DATABASE_URL` is set.

## Experimental browser gaze quickstart

This mode is for local experimentation only. It is approximate, browser-dependent, quality-gated, opt-in, and not medical-grade.

```bash
cd frontend
VITE_ENABLE_WEBGAZER=true npm run dev
```

Then open `http://localhost:5173`, choose `Browser gaze experiment`, read the consent notice, allow browser camera permission, click each calibration target while looking at it, and complete a short session. If permission, lighting, device support, or calibration quality is poor, switch back to `Use synthetic demo`.

Set `VITE_WEBGAZER_SCRIPT_URL` only if you need to point the browser at a different WebGazer script URL. WebGazer is not required for the default demo.

## Privacy guarantees

- Synthetic mode does not request camera permission.
- Browser gaze mode is hidden by default, feature-flagged, and consent-gated.
- Raw webcam video is not sent to the backend or stored.
- Raw frames, screenshots, image blobs, base64 media, and media-like event payloads are rejected.
- Persisted telemetry is limited to UX-analysis fields such as event type, timestamps, normalized coordinates, confidence/quality metadata, task context, clicks, scrolls, and calibration summaries.
- Reports and replay are generated from persisted telemetry and computed metrics, not video or screenshot playback.
- The project does not claim biometric identity, perfect gaze accuracy, medical-grade tracking, or generic session recording.

## Architecture overview

```text
frontend capture
  -> telemetry contract mapping
  -> FastAPI ingest validation
  -> SQLite append-only telemetry rows
  -> backend analytics/report helpers
  -> persisted report payload
  -> React report/replay display
```

Key boundaries:

- `frontend/src/tracking/`: synthetic tracker and optional WebGazer adapter.
- `frontend/src/components/`: study builder, session controls, tracker status, demo guide, reports, and schematic replay.
- `backend/app/api/`: domain routes for studies, sessions, events, reports, health, and metadata.
- `backend/app/services/`: fixation, AOI metrics, replay, and session quality helpers.
- `docs/`: architecture, contracts, demo walkthrough, privacy model, limitations, and roadmap.

See [docs/architecture.md](docs/architecture.md) and [docs/event-report-data-flow.md](docs/event-report-data-flow.md) for the longer system view.

## Test commands

Backend:

```bash
cd backend
source .venv/bin/activate
PYTHONPATH=. pytest
```

Frontend:

```bash
cd frontend
npm test
npm run build
npm run e2e
```

Install Playwright browsers once if needed:

```bash
cd frontend
npx playwright install chromium
```

Validation run for this checkout during portfolio polish: frontend unit tests `56 passed`, frontend build passed, backend tests `42 passed`, and Playwright E2E `1 passed`. Re-run the commands above after future changes before relying on status.

## Current limitations

- Synthetic telemetry is deterministic demo data, not observed human gaze.
- Browser gaze is an experimental spike and can be noisy across browsers, lighting, cameras, face position, and permissions.
- AOIs are manual normalized rectangles; DOM-derived AOIs and screenshot-assisted authoring are not implemented.
- Session replay is a schematic normalized-coordinate visualization, not video replay or screenshot playback.
- Fixations and quality scores are deterministic demo heuristics, not validated clinical or hardware-eye-tracking metrics.
- No auth, teams, deployment, exports, share links, retention/deletion UI, or production analytics jobs yet.
- CAF delay is documented as future terminology but not claimed as an implemented report metric.

## Roadmap / next milestones

- Add multi-session study summaries and clearer task success metrics.
- Add retention/deletion workflows before any production data collection.
- Harden event schema versioning and privacy regression tests.
- Improve AOI authoring with DOM/page assistance while keeping media persistence out of ingest.
- Validate browser gaze quality thresholds before promoting any real-gaze capability.
- Add report export/share flows only after auth and least-privilege access controls exist.

See [docs/mvp-roadmap.md](docs/mvp-roadmap.md) for more detail.

## Suggested demo script

1. Open the app and point out the Demo Guide and privacy notice.
2. Review the study objective, task prompt, and normalized AOIs.
3. Keep `Synthetic demo` selected and explain that it is deterministic, camera-free demo data.
4. Start the demo session, run synthetic calibration, wait for all events, and complete the session.
5. Inspect ingest status: accepted, rejected, and stored event counts.
6. Review the backend report: tracker mode, event counts, AOI metrics, TTFF, fixation summary, quality verdict, and privacy summary.
7. Show the schematic replay and clarify that it is generated from telemetry, not webcam video or screenshots.
8. Optionally restart with `VITE_ENABLE_WEBGAZER=true` to show the consent-gated browser experiment and its limitations.

## Screenshot / GIF placeholders

Add screenshots or short GIFs later under a future `docs/assets/` folder, for example:

- `docs/assets/demo-guide.png`
- `docs/assets/synthetic-session.gif`
- `docs/assets/backend-report.png`
- `docs/assets/browser-gaze-consent.png`

Do not add real tester webcam imagery, raw frames, screenshots containing private data, or base64 media payload examples.
