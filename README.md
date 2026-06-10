# GazeTrack

GazeTrack is a privacy-first, task-based UX analytics MVP for website builders. It shows how a browser frontend, typed telemetry contracts, a FastAPI ingest layer, SQLite persistence, a website capture SDK, and backend-generated reports can work together to evaluate whether users notice and act on important page regions. The synthetic path remains deterministic and camera-free; real-site capture is interaction-only by default; browser gaze is optional, experimental, approximate, and not medical-grade eye tracking.

## What is implemented now

- React + TypeScript + Vite dashboard for study setup, demo session flow, telemetry status, and reports.
- Configurable synthetic study setup with study name, objective, target URL/label, task prompts, and normalized AOIs.
- Default `SyntheticTracker` with deterministic calibration, gaze, click, scroll, and task events.
- Synthetic quality modes: `healthy`, `low_confidence`, `bad_calibration`, and `no_gaze`.
- Optional `WebGazerTracker` experiment hidden behind `VITE_ENABLE_WEBGAZER=true`, consent, and browser support checks.
- Standalone real-site capture embed with interaction-only mode by default and an opt-in WebGazer setup flow for controlled websites.
- Versioned public SDK path, dedicated capture API namespace, capture tokens, per-study origin allowlists, idempotent event delivery, retry-aware flushing, and dashboard install helper for controlled-site integrations.
- FastAPI + SQLite persistence for studies, tasks, AOIs, tester sessions, accepted telemetry events, and report payloads.
- Privacy-safe ingest validation that rejects media-like payload keys before persistence.
- Backend reports with executive summaries, quality interpretation, AOI attention ranking, first/most/weak attention callouts, recommended next actions, event counts, AOI metrics, CAF delay when available, and schematic replay data.
- In-app Demo Guide for reviewers and integration notes for controlled-site setup.

## Current status

- Synthetic mode: stable default demo path with deterministic, camera-free telemetry.
- Website integration MVP: implemented for controlled websites through `/sdk/v0.2/gazetrack-capture.js` and `/api/v1/capture/...`, with interaction telemetry by default.
- Experimental browser gaze: opt-in browser experiment behind `VITE_ENABLE_WEBGAZER=true`; approximate, browser-dependent, and not medical-grade.
- Reports: quality-aware UX insight reports with AOI ranking, attention callouts, cautious interpretation, and next-action recommendations.
- Privacy: no raw webcam video, frames, screenshots, image blobs, base64 media, or media-like payloads are stored.

## Synthetic mode quickstart

Synthetic mode is the default and the recommended demo path. It does not request webcam permission.

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
The backend also loads the project-root `.env` file when present. For real-site embedding, set
`GAZETRACK_CORS_ALLOWED_ORIGINS` to include the tested website origin; the example config includes GazeTrack local
ports, common ShotzWeb local ports, `https://shotzapp.app`, and `https://www.shotzapp.app`.

## Experimental browser gaze quickstart

This mode is for local experimentation only. It is approximate, browser-dependent, quality-gated, opt-in, and not medical-grade.

```bash
cd frontend
VITE_ENABLE_WEBGAZER=true npm run dev
```

Then open `http://localhost:5173`, choose `Browser gaze experiment`, read the consent notice, allow browser camera permission, click each calibration target while looking at it, and complete a short session. If permission, lighting, device support, or calibration quality is poor, switch back to `Use synthetic demo`.

Set `VITE_WEBGAZER_SCRIPT_URL` only if you need to point the browser at a different WebGazer script URL. WebGazer is not required for the default demo.

## Real-site capture embed

Controlled websites can include the standalone vanilla script with one config object and one script tag. The default mode is interaction-only: it creates a capture session, snapshots configured AOIs from the live page, and records page view, task, click, and scroll telemetry. If `window.webgazer` is already present, it may sample approximate gaze points, but the embed does not load WebGazer unless explicitly enabled.

```html
<script>
  window.GazeTrackConfig = {
    apiBaseUrl: 'https://your-gazetrack-api.example',
    studyId: '00000000-0000-0000-0000-000000000000',
    captureToken: 'capture-token-from-snippet-config'
  }
</script>
<script src="https://your-gazetrack-api.example/sdk/v0.2/gazetrack-capture.js" async></script>
```

New integrations should use the versioned `/sdk/v0.2/gazetrack-capture.js` SDK path. The legacy `/gazetrack-capture.js` path remains available for existing controlled-site embeds.
The SDK submits website telemetry through the token-protected `/api/v1/capture/...` API namespace while legacy dashboard/demo endpoints remain available for local synthetic runs.
Studies can set `allowed_origins` such as `["https://example.com"]` so public capture config/session/event requests are accepted only when the browser `Origin` exactly matches the study allowlist. Leave the allowlist empty for local/demo behavior. This app-level check complements global CORS and capture tokens; it is not a replacement for future dashboard/admin authentication.
Use `POST /api/v1/studies/{study_id}/capture-token/rotate` to revoke a leaked or stale capture token and get a fresh snippet config. The old token stops working immediately. Because dashboard auth is not implemented yet, snippet-config and token-rotation routes are local/demo-admin APIs.
The dashboard Website integration panel and `GET /api/v1/studies/{study_id}/install-verification` return the current versioned snippet, target URL, allowed origins, and AOI selectors/role keys for local/demo-admin install checks. This helper does not crawl, scan, screenshot, or fetch the target site.
Real-site layout snapshots default to structural metadata only. Arbitrary DOM text from headings, paragraphs, links, and buttons is not persisted unless `captureText: true` is set with explicit `allowedTextSelectors`; `redactSelectors` and form fields always suppress text. AOI labels may appear in reports because they are study-owner configuration.
Event delivery is retry-safe when the SDK supplies opaque `batch_id` and `client_event_id` values. The backend skips duplicate `(session_id, client_event_id)` rows and reports accepted, rejected, duplicate, and skipped counts. The SDK also flushes periodically, on visibility/page lifecycle changes, and before completing a capture session.

For WebGazer-enabled real-site capture, add:

```html
<script>
  window.GazeTrackConfig = {
    apiBaseUrl: 'https://your-gazetrack-api.example',
    studyId: '00000000-0000-0000-0000-000000000000',
    captureToken: 'capture-token-from-snippet-config',
    enableWebGazer: true,
    webgazerScriptUrl: 'https://webgazer.cs.brown.edu/webgazer.js',
    calibrationPasses: 1,
    requireCameraReadiness: true
  }
</script>
<script src="https://your-gazetrack-api.example/sdk/v0.2/gazetrack-capture.js" async></script>
```

This mode is consent-gated. It loads WebGazer only after the tester starts setup, hides WebGazer preview/prediction UI, shows a local-only camera readiness preview, requires full-viewport calibration clicks, then starts task capture. It submits telemetry only: normalized gaze coordinates, confidence when available, calibration summaries, quality events, clicks, scrolls, and task events with `source`/`tracker_type` set to `real_site_capture`. WebGazer capture is approximate, browser-dependent, and not medical-grade.

### Real-site troubleshooting

- CORS/origin mismatch: include the target site in `GAZETRACK_CORS_ALLOWED_ORIGINS` and, when a study has `allowed_origins`, add the exact browser origin such as `https://example.com`. Paths, query strings, and mismatched ports do not match.
- Invalid token: copy the current dashboard Website integration snippet or call `GET /api/v1/studies/{study_id}/capture-snippet-config`. If a token was leaked or stale, rotate it with `POST /api/v1/studies/{study_id}/capture-token/rotate` and redeploy the snippet.
- AOI not detected: verify the page contains the configured selector or `data-gazetrack-aoi` role key, that the element is visible when the task starts, and that the study target route matches the tested page.
- Iframe blocked in report view: some target sites set frame-blocking headers. The report view can still show schematic telemetry, AOI snapshots, and metrics without embedding the live site.
- Backend unavailable: the SDK cannot create sessions or flush telemetry while FastAPI is unreachable. Restart the backend, verify `apiBaseUrl`, and keep the synthetic demo path for camera-free local validation.

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

Release 003 validation is tracked in [docs/release-003-checklist.md](docs/release-003-checklist.md). Re-run the commands above in the current checkout before relying on status.

## Current limitations

- Synthetic telemetry is deterministic demo data, not observed human gaze.
- Browser gaze is an experimental spike and can be noisy across browsers, lighting, cameras, face position, and permissions.
- Real-site capture is intended for controlled websites where the study owner can install the SDK and configure AOI selectors.
- AOI authoring is still explicit/manual through study config and selectors; screenshot-assisted authoring is not implemented.
- Session replay is a schematic normalized-coordinate visualization, not video replay or screenshot playback.
- Fixations and quality scores are deterministic demo heuristics, not validated clinical or hardware-eye-tracking metrics.
- No auth, teams, deployment, exports, share links, retention/deletion UI, or production analytics jobs yet.

## Roadmap / next milestones

- Add multi-session study summaries and clearer task success metrics.
- Add retention/deletion workflows before any production data collection.
- Harden event schema versioning and privacy regression tests.
- Improve AOI authoring with DOM/page assistance while keeping media persistence out of ingest.
- Validate browser gaze quality thresholds before promoting any real-gaze capability.
- Add report export/share flows only after auth and least-privilege access controls exist.
- Add authenticated dashboard/admin controls before treating snippet, install-verification, or token-rotation routes as production admin APIs.

See [docs/mvp-roadmap.md](docs/mvp-roadmap.md) for more detail.

## Suggested demo script

1. Open the app and point out the Demo Guide and privacy notice.
2. Review the study objective, task prompt, and normalized AOIs.
3. Keep `Synthetic demo` selected and explain that it is deterministic, camera-free demo data.
4. Start the demo session, run synthetic calibration, wait for all events, and complete the session.
5. Inspect ingest status: accepted, rejected, and stored event counts.
6. Review the backend report: executive summary, quality interpretation, AOI ranking, first/most/weak attention callouts, recommendations, tracker mode, event counts, AOI metrics, CAF delay when available, and privacy summary.
7. Show the schematic replay and clarify that it is generated from telemetry, not webcam video or screenshots.
8. Optionally restart with `VITE_ENABLE_WEBGAZER=true` to show the consent-gated browser experiment and its limitations.

## Project summary bullets

- Built a privacy-first React/FastAPI UX analytics demo with configurable studies, task prompts, normalized AOIs, synthetic telemetry, SQLite persistence, and backend-generated reports.
- Implemented quality-aware AOI insight reporting with TTFF, fixation dwell, attention share, CAF delay, weak-attention detection, and cautious next-action recommendations.
- Preserved strict privacy boundaries by rejecting media-like payloads and storing only telemetry needed for UX analysis.
- Added deterministic tests across ingestion, schema validation, quality scoring, report insights, frontend rendering, build, and Playwright synthetic happy path.
