# API Contracts (placeholder implementation)

These contracts describe the currently implemented minimal backend stubs.

## Routes

- `GET /health` → `{ "status": "ok" }`
- `GET /api/v1/meta` → project metadata + privacy posture + implemented placeholders
- `POST /api/v1/studies` → accepts `name`, optional `objective`, optional `target_url`; returns generated `study_id`
- `GET /api/v1/studies/{study_id}` → returns placeholder study envelope
- `POST /api/v1/studies/{study_id}/sessions` → returns generated `session_id`
- `POST /api/v1/sessions/{session_id}/events` → accepts single event or `{ "events": [...] }`; validates event shape and rejects media-like payload keys
- `POST /api/v1/sessions/{session_id}/complete` → returns placeholder completion status
- `GET /api/v1/sessions/{session_id}/report` → returns placeholder report envelope

## Event types currently allowed

- `gaze`
- `click`
- `scroll`
- `task_start`
- `task_complete`
- `calibration`
- `quality`
- `page_view`

## Privacy constraints

Event payloads containing keys that look like raw media are rejected (case-insensitive):

- `video`
- `frame`
- `image`
- `base64`
- `blob`
- `webcam_frame`

No persistence, auth, analytics computation, or webcam tracking is implemented in this placeholder phase.
