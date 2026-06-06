# Contracts Directory

This folder contains draft JSON Schemas for key data contracts used by GazeOps.

## Files
- `study.schema.json` — study/page/AOI/session-calibration envelope.
- `events.schema.json` — telemetry event batch contract (gaze/click/scroll/task).
- `session-report.schema.json` — session quality + report summary payload.

## Notes
- Schemas are draft contracts for implementation alignment.
- Contracts intentionally exclude webcam frame/video storage fields.
- Keep `sample-data/` examples aligned with these schemas.
