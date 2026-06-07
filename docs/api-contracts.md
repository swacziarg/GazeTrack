# API Contracts (placeholder implementation)

These contracts describe the currently implemented minimal backend stubs and demo-only in-memory telemetry flow.

## Routes

- `GET /health` → `{ "status": "ok" }`
- `GET /api/v1/meta` → project metadata + privacy posture + implemented placeholders
- `POST /api/v1/studies` → accepts `name`, optional `objective`, optional `target_url`; returns generated `study_id`
- `GET /api/v1/studies/{study_id}` → returns placeholder study envelope
- `POST /api/v1/studies/{study_id}/sessions` → returns generated `session_id`
- `POST /api/v1/sessions/{session_id}/events` → accepts single event or `{ "events": [...] }`; validates event shape, rejects media-like payload keys, and stores accepted telemetry in process-local demo memory
- `POST /api/v1/sessions/{session_id}/complete` → marks the demo session complete in process-local memory and returns `event_count`
- `GET /api/v1/sessions/{session_id}/report` → returns a backend-generated demo report from stored synthetic telemetry

## Demo report fields

`GET /api/v1/sessions/{session_id}/report` includes:

- `event_count`
- `event_type_counts`
- `first_event_timestamp`
- `last_event_timestamp`
- `contains_gaze_events`
- `low_confidence_sample_rate`
- `session_quality_score`
- `insights`

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

Accepted telemetry is stored only in process-local demo memory. It resets on server restart and is not database, Supabase, or production persistence.

No auth, webcam tracking, real analytics jobs, or raw media storage is implemented in this placeholder phase.
