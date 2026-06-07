# GazeTrack Frontend

Static React + TypeScript + Vite shell for the GazeTrack MVP.

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

## Backend URL

The backend status card calls `GET {VITE_API_BASE_URL}/health`. Completing the synthetic demo session also attempts to POST the generated telemetry batch to:

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
initializing the adapter. The adapter uses guarded `window.webgazer` access and sends only privacy-safe telemetry:
normalized gaze points, optional confidence/quality metadata, timestamps, clicks, scrolls, calibration events, and task
events. Raw video, frames, images, screenshots, blobs, and base64 media are not sent or stored. Browser gaze estimates
are approximate and not medical-grade eye tracking.

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
- Bundled WebGazer dependency
- Authentication
- Real analytics computation or production report generation
- Real heatmaps, production gaze replay tracking, video replay, or chart visualizations
