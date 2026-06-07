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

## Backend URL

The backend status card calls `GET {VITE_API_BASE_URL}/health`.

Set `VITE_API_BASE_URL` in a local `.env` file if the FastAPI backend is not running on the default URL:

```bash
VITE_API_BASE_URL=http://localhost:8000
```

## Intentionally Not Implemented Yet

- Webcam tracking and browser permission prompts
- WebGazer integration
- Authentication
- Real analytics computation or report generation
- Real heatmaps, gaze replay rendering, or chart visualizations
