# Frontend

Minimal React + TypeScript + Vite shell for GazeOps.

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

## Build check

```bash
npm run build
```

## Backend dependency note

The status card calls `GET /health` on the backend API. Start backend first if you want the card to show `Online`.

## Environment variable

Copy `.env.example` to `.env` and set:

- `VITE_API_BASE_URL` (default: `http://localhost:8000`)

## Intentionally unimplemented

- Webcam access and browser permission prompts
- WebGazer/gaze tracking integration
- Auth and persistent storage
- Real telemetry ingestion and report generation
- Real heatmap rendering, gaze replay, and AOI charts
- Advanced routing/state management and deployment setup
