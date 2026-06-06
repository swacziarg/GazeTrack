# API Contracts (Draft)

These are draft, implementation-ready contracts for early scaffolding. They are not a guarantee that full endpoint logic exists yet.

## GET /health
Basic service health check.

### 200 example
```json
{
  "status": "ok",
  "service": "gazeops-api",
  "version": "0.1.0-draft"
}
```

## GET /api/v1/meta
Returns API and contract metadata.

### 200 example
```json
{
  "api_version": "v1",
  "contract_version": "2026-06-draft",
  "capabilities": {
    "studies": "draft",
    "sessions": "draft",
    "events": "draft",
    "reports": "draft"
  },
  "privacy": {
    "stores_raw_webcam_video": false,
    "notes": "Telemetry-only persistence model"
  }
}
```

## POST /api/v1/studies
Create a study definition.

### Request example
```json
{
  "name": "Landing Page CTA Validation",
  "objective": "Check whether testers notice and use primary CTA",
  "status": "draft",
  "pages": [
    {
      "id": "page_home",
      "url": "https://example.test/landing",
      "task_prompt": "Find and click Start Free Trial",
      "aois": [
        {
          "id": "aoi_cta",
          "name": "Primary CTA",
          "shape": "rect",
          "coordinates": { "x": 0.62, "y": 0.18, "width": 0.2, "height": 0.09 }
        }
      ]
    }
  ]
}
```

### 201 example
```json
{
  "study_id": "study_123",
  "status": "draft",
  "created_at": "2026-06-06T00:00:00Z"
}
```

## GET /api/v1/studies/{study_id}
Fetch one study and its page/AOI draft config.

### 200 example
```json
{
  "study_id": "study_123",
  "name": "Landing Page CTA Validation",
  "objective": "Check whether testers notice and use primary CTA",
  "status": "draft",
  "pages": []
}
```

## POST /api/v1/studies/{study_id}/sessions
Create a tester session envelope.

### Request example
```json
{
  "tester_id": "tester_anon_001",
  "device": {
    "browser": "chrome",
    "viewport_width": 1440,
    "viewport_height": 900
  }
}
```

### 201 example
```json
{
  "session_id": "session_abc",
  "study_id": "study_123",
  "status": "created",
  "created_at": "2026-06-06T00:00:00Z"
}
```

## POST /api/v1/sessions/{session_id}/events
Ingest batched telemetry events for a session.

### Request example
```json
{
  "session_id": "session_abc",
  "events": [
    {
      "event_type": "gaze",
      "timestamp": "2026-06-06T00:01:00Z",
      "x": 812.4,
      "y": 231.9,
      "viewport_width": 1440,
      "viewport_height": 900,
      "confidence": 0.91
    },
    {
      "event_type": "click",
      "timestamp": "2026-06-06T00:01:03Z",
      "x": 905,
      "y": 255,
      "button": "left",
      "target_hint": "primary_cta"
    }
  ]
}
```

### 202 example
```json
{
  "session_id": "session_abc",
  "accepted_events": 2,
  "rejected_events": 0,
  "status": "accepted"
}
```

## POST /api/v1/sessions/{session_id}/complete
Mark session complete and trigger report pipeline.

### Request example
```json
{
  "ended_at": "2026-06-06T00:05:00Z",
  "task_outcome": "completed"
}
```

### 202 example
```json
{
  "session_id": "session_abc",
  "status": "processing",
  "message": "Session completion accepted; report generation queued"
}
```

## GET /api/v1/sessions/{session_id}/report
Fetch session report summary.

### 200 example
```json
{
  "session_id": "session_abc",
  "quality": {
    "score": 86,
    "band": "good"
  },
  "task": {
    "outcome": "completed",
    "duration_ms": 241000
  },
  "summary": {
    "first_fixation_target_ms": 4600,
    "cta_fixated": true,
    "cta_clicked": true
  }
}
```

## Status codes (draft guidance)
- `200`: successful read
- `201`: resource created
- `202`: accepted for async processing
- `400`: invalid request shape
- `404`: not found
- `409`: invalid session state transition
- `501`: endpoint exists but is not fully implemented yet
