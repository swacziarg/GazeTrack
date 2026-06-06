# Gaze Tracking Integration Checklist

- [ ] Define browser permission UX and consent copy
- [ ] Implement calibration flow with retry guidance
- [ ] Set explicit confidence thresholds for usable samples
- [ ] Ensure local frame processing in browser where feasible
- [ ] Enforce no raw video storage in ingest/storage layers
- [ ] Provide fallback flow when webcam access is denied
- [ ] Document known limitations and uncertainty messaging
- [ ] Validate coordinate normalization across viewport/scroll states
- [ ] Add telemetry schema versioning for tracker changes
- [ ] Add QA scenarios for low light/device variability
