# Backend

Minimal FastAPI placeholder API for GazeTrack. This backend intentionally exposes stable endpoint stubs plus a process-local demo telemetry store for synthetic development flows.

## Install

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
cd backend
uvicorn app.main:app --reload
```

## Test

```bash
cd backend
PYTHONPATH=. pytest
```

## Endpoints

- `GET /health`
- `GET /api/v1/meta`
- `POST /api/v1/studies`
- `GET /api/v1/studies/{study_id}`
- `POST /api/v1/studies/{study_id}/sessions`
- `POST /api/v1/sessions/{session_id}/events`
- `POST /api/v1/sessions/{session_id}/complete`
- `GET /api/v1/sessions/{session_id}/report`

## In-memory demo storage

`POST /api/v1/sessions/{session_id}/events` validates incoming synthetic telemetry and stores accepted events in process-local memory keyed by `session_id`. Rejected media-like payloads are not stored.

This storage is demo-only:

- It resets when the FastAPI server restarts.
- It is not a database, Supabase, or production persistence layer.
- It is not thread-safe or suitable for multi-process deployments.
- It stores validated telemetry event envelopes only, never raw webcam video, frames, images, blobs, or base64 media payloads.

`GET /api/v1/sessions/{session_id}/report` returns a backend-generated demo report from the stored synthetic events, including event counts, event type counts, first/last event timestamps, gaze-event presence, low-confidence sample rate, a simple quality score, and privacy-first insights.

## Intentional limitations

- No authentication/authorization yet.
- No database persistence yet.
- No Supabase wiring yet.
- No webcam tracking implementation.
- No production report analytics computation.
- No raw webcam video/image/frame storage.
