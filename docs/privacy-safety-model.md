# Privacy and Safety Model

GazeTrack is designed around a narrow data boundary: collect task analytics telemetry, not raw media.

## Current guarantees

- Synthetic mode is the default and does not request camera permission.
- Experimental browser gaze mode is hidden unless `VITE_ENABLE_WEBGAZER=true`.
- Browser gaze mode requires explicit in-app consent before initialization.
- Raw webcam video is not sent to FastAPI and is not persisted.
- Raw frames, screenshots, image blobs, base64 media, and media-like payload keys are rejected before persistence.
- Backend reports and schematic replay are generated from accepted telemetry and computed metrics only.

## Data that may be stored

Accepted telemetry can include:

- Event type.
- Session ID.
- Client event timestamp.
- Server ingest timestamp.
- Normalized gaze/click coordinates.
- Confidence and calibration quality metadata.
- Task labels/prompts needed for report context.
- Scroll depth and click metadata.
- Tracker type such as `synthetic` or `webgazer_experimental`.

This is local SQLite demo storage by default.

## Data that must not be stored

The current implementation must not persist:

- Webcam video.
- Webcam frames.
- Screenshot uploads.
- Image blobs.
- Base64 media payloads.
- Generic session-recording media.
- Biometric identity templates.

Backend tests cover rejection of media-like event payload keys. Any future tracker or report feature should preserve that boundary.

## Safety and positioning rules

- Do not position the project as medical-grade eye tracking.
- Do not claim perfect gaze accuracy.
- Do not imply biometric identity or authentication.
- Do not present browser gaze mode as production-ready.
- Treat quality and confidence as first-class report fields.
- Prefer phrases such as "synthetic telemetry," "experimental," "approximate," "quality-gated," and "not medical-grade."

## Future privacy work

Before production data collection, add:

- Retention/deletion controls.
- Team/auth access control.
- Audit logging for report access.
- Clear tester consent records.
- Stronger event schema versioning.
- Expanded privacy regression tests.
