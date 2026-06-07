# Backend

Minimal FastAPI placeholder API for GazeTrack. This backend intentionally exposes stable endpoint stubs without implementing production logic.

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

## Intentional limitations

- No authentication/authorization yet.
- No database persistence yet.
- No Supabase wiring yet.
- No webcam tracking implementation.
- No report analytics computation.
- No raw webcam video/image/frame storage.
