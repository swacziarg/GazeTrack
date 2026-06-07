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

Tests currently cover the synthetic mock event, event contract adapter, demo report utilities, and synthetic visualization helpers.

## Backend URL

The backend status card calls `GET {VITE_API_BASE_URL}/health`. Completing the synthetic demo session also attempts to POST the generated telemetry batch to:

```text
POST {VITE_API_BASE_URL}/api/v1/sessions/{session_id}/events
```

This ingest call uses synthetic events only and targets the backend placeholder validation route. The frontend still generates the local demo report from local state regardless of whether ingest succeeds.

After ingest succeeds, the frontend also attempts to fetch a backend-generated demo report from:

```text
GET {VITE_API_BASE_URL}/api/v1/sessions/{session_id}/report
```

The backend report panel is labeled as a demo report and is generated from process-local demo telemetry only. It is rendered separately from the local demo report.

## Synthetic Report Visuals

After completing the mock session, the local report renders synthetic visual previews:

- Synthetic demo heatmap preview
- Synthetic demo gaze path
- Demo-derived AOI attention breakdown

These visuals are generated from mock telemetry positions and demo AOI boxes only. They are not webcam tracking, WebGazer output, raw media processing, or production heatmap analytics.

Set `VITE_API_BASE_URL` in a local `.env` file if the FastAPI backend is not running on the default URL:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

If the backend is offline, the local demo report still renders and the backend panel shows: `Backend unavailable — showing local demo report only.`

## Intentionally Not Implemented Yet

- Webcam tracking and browser permission prompts
- WebGazer integration
- Authentication
- Real analytics computation or production report generation
- Real heatmaps, real gaze replay tracking, or chart visualizations
