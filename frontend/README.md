# GazeTrack Frontend

React + TypeScript + Vite frontend for the GazeTrack `v0.1-demo` synthetic telemetry dashboard.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Test

```bash
npm run test
```

Tests currently cover the synthetic tracker, feature-flagged tracker selection, WebGazer adapter normalization, event contract adapter, backend ingest client, demo report utilities, backend report rendering, and synthetic visualization helpers.

## E2E

Install the Playwright browser once if needed:

```bash
npx playwright install chromium
```

Run the synthetic happy path:

```bash
npm run e2e
```

Run this after the backend install step has created `backend/.venv` and installed `backend/requirements.txt` into it.
The Playwright config starts FastAPI on `http://127.0.0.1:8000` with
`GAZETRACK_DATABASE_URL=sqlite:////private/tmp/gazetrack-e2e.db`, starts Vite on `http://127.0.0.1:5173`, runs the
default synthetic session, and verifies successful backend ingest/report UI. WebGazer remains disabled.

## Backend URL

The backend status card calls `GET {VITE_API_BASE_URL}/health`. Completing the synthetic demo session also attempts to POST the generated synthetic telemetry batch to:

```text
POST {VITE_API_BASE_URL}/api/v1/sessions/{session_id}/events
```

This ingest call uses synthetic events only and targets the backend telemetry validation route. The demo session includes a synthetic calibration step with five target dots, generated target/observed/error payload fields, clustered gaze samples, scroll/click events, and task start/complete events. The frontend still generates the local demo report from local state regardless of whether ingest succeeds.

After ingest succeeds, the frontend also attempts to fetch a backend-generated demo report from:

```text
GET {VITE_API_BASE_URL}/api/v1/sessions/{session_id}/report
```

The backend report panel is labeled as a demo report and is generated from SQLite-backed persisted demo telemetry. It is rendered separately from the local demo report. When the report includes replay data, the panel also renders a schematic normalized-coordinate session replay with AOI boxes, gaze samples, fixation centroids, click markers, task/scroll markers, and a scrubber.

## Tracker Modes

Synthetic telemetry is the default tracker mode. It does not load browser gaze code and does not request camera
permission. The synthetic tracker keeps the existing `healthy`, `low_confidence`, `bad_calibration`, and `no_gaze`
quality modes.

The browser gaze experiment is hidden unless this flag is set:

```bash
VITE_ENABLE_WEBGAZER=true
```

When enabled, the UI shows `Browser gaze experiment` as an opt-in tracker. The app displays consent copy before
initializing the adapter. After consent, the adapter loads WebGazer in the browser, hides the local camera preview and
prediction markers, asks the tester to click/fixate calibration targets, samples predictions at a throttled interval,
and sends only privacy-safe telemetry: normalized gaze points, optional confidence/quality metadata, timestamps,
calibration events, and task events. Raw video, frames, images, screenshots, blobs, and base64 media are not sent or
stored. Browser gaze estimates are approximate and not medical-grade eye tracking. During browser gaze sessions, the UI
shows local-only tracker state, sample counts, elapsed capture time, calibration feedback, weak-signal/fallback messages,
and an optional approximate gaze-dot overlay.

To try it locally:

```bash
VITE_ENABLE_WEBGAZER=true npm run dev
```

Troubleshooting: use `localhost` or HTTPS, allow camera permission, improve lighting and face position when calibration
is weak, expect the debug dot to be noisy, and switch back to `Synthetic demo` when permission, loading, or signal quality
is not usable.

Use `localhost` or HTTPS, allow camera permission, select `Browser gaze experiment`, consent, start the session, click
each calibration target while looking at it, then complete the session after a few seconds of samples. Set
`VITE_WEBGAZER_SCRIPT_URL` if you need to use a different WebGazer script URL. If predictions do not appear, check
camera permission, browser support, lighting, tab focus, and script loading.

## Real-Site Capture Embed

`frontend/public/gazetrack-capture.js` is a standalone vanilla-JS embed for controlled websites. It does not depend on
React. Integrators provide one `window.GazeTrackConfig` object and one script include.

Interaction-only mode is the default:

```html
<script>
  window.GazeTrackConfig = {
    apiBaseUrl: 'http://localhost:8000',
    studyId: 'study-id',
    captureToken: 'capture-token'
  }
</script>
<script src="/gazetrack-capture.js" async></script>
```

WebGazer-enabled mode is explicit:

```html
<script>
  window.GazeTrackConfig = {
    apiBaseUrl: 'http://localhost:8000',
    studyId: 'study-id',
    captureToken: 'capture-token',
    enableWebGazer: true,
    webgazerScriptUrl: 'https://webgazer.cs.brown.edu/webgazer.js',
    calibrationPasses: 1,
    requireCameraReadiness: true
  }
</script>
<script src="/gazetrack-capture.js" async></script>
```

The WebGazer embed path shows consent copy before loading/starting WebGazer, runs a local-only camera readiness preview,
uses full-viewport calibration targets, then records task telemetry. It sends only normalized coordinates, confidence
when available, quality metadata, calibration summaries, clicks, scrolls, and task events as `real_site_capture`.
WebGazer estimates are approximate, browser-dependent, and not medical-grade.

## Synthetic Report Visuals

After completing the mock session, the local report renders synthetic visual previews:

- Synthetic demo heatmap preview
- Synthetic demo gaze path
- Demo-derived AOI attention breakdown

These visuals are generated from mock telemetry positions and demo AOI boxes only. They are not webcam tracking, WebGazer output, raw media processing, or production heatmap analytics.

The backend session replay uses persisted telemetry and computed fixations only. It is a static SVG overlay over normalized 0-1 coordinates and does not request, store, or render webcam video, page screenshots, images, blobs, or base64 media. The scrubber filters replay markers by relative event time so future events are hidden until the selected timeline point reaches them.

The synthetic generator supports `healthy`, `low_confidence`, `bad_calibration`, and `no_gaze` quality modes so the backend report can demonstrate pass/warn/fail verdicts. No synthetic mode requests camera permission or stores webcam video, frames, images, blobs, or base64 media.

Set `VITE_API_BASE_URL` in a local `.env` file if the FastAPI backend is not running on the default URL:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

If the backend is offline, the local demo report still renders and the backend panel shows: `Backend unavailable — showing local demo report only.`

## Intentionally Not Implemented Yet

- Production-grade webcam tracking
- Default camera/webcam tracking
- Authentication
- Production-grade analytics, heatmaps, or report generation
- CAF delay
- DOM-derived AOI detection
- Export/share flows
- Production gaze replay tracking, video replay, screenshot replay, or chart visualizations
