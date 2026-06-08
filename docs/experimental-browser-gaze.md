# Experimental Browser Gaze Limitations

The browser gaze path exists to show a future integration boundary, not to prove production-grade eye tracking.

## How to enable it

```bash
cd frontend
VITE_ENABLE_WEBGAZER=true npm run dev
```

When enabled, the app reveals `Browser gaze experiment` in the tracker selector. It still requires explicit consent before initialization and browser camera permission before predictions can work.

## What it does

- Loads WebGazer only in the browser experiment path.
- Loads MediaPipe Tasks Vision face landmarking only in the browser experiment path after consent.
- Hides WebGazer's local camera preview and prediction points.
- Runs camera readiness checks locally from derived face box, eye visibility, approximate head pose, lighting, stability, and sample-rate signals.
- Shows a five-point calibration overlay.
- Samples approximate predictions at a throttled interval.
- Emits compatible telemetry such as normalized gaze points, confidence/quality metadata, timestamps, calibration events, task events, clicks, and scrolls.
- Shows local status, weak-signal, and calibration feedback.

## What it does not do

- It does not make GazeTrack medical-grade.
- It does not guarantee accurate gaze position.
- It does not upload raw webcam video.
- It does not persist frames, screenshots, image blobs, or base64 media.
- It does not persist raw face landmarks, face embeddings, or biometric identity data.
- It does not treat local face/head setup signals as gaze accuracy guarantees.
- It does not replace the recommended synthetic demo path.
- It does not validate production tracker performance.

## Known sources of poor quality

- Camera permission denied or unavailable.
- Non-local insecure origins where camera APIs are blocked.
- Poor lighting, glare, face angle, or camera position.
- Browser/device variance.
- Tab focus loss or script loading failure.
- Weak calibration due to missed target clicks or noisy predictions.

## Recommended reviewer framing

Use synthetic mode to evaluate the implemented product/data pipeline. Use browser gaze only to discuss how the tracker abstraction, consent gate, quality feedback, and privacy-safe event envelope could support future browser-native gaze research.

## Real-site embed mode

The controlled-site embed at `frontend/public/gazetrack-capture.js` has two modes:

- Interaction-only real-site capture is the default. It uses `window.GazeTrackConfig`, creates a capture session, snapshots configured AOIs from the page, and records task, click, scroll, and page-view telemetry.
- WebGazer-enabled real-site capture requires `enableWebGazer: true`. The embed shows consent copy before loading WebGazer, starts setup only after the tester opts in, disables WebGazer session persistence and built-in preview/prediction UI, runs a lightweight local-only camera readiness phase, uses full-viewport calibration targets, then records capped gaze samples during the task.

Real-site WebGazer events keep `source: "real_site_capture"` and `tracker_type: "real_site_capture"` so existing capture-token validation and reports continue to work. The standalone embed does not reuse the React/MediaPipe readiness component; its fallback readiness check is intentionally limited to camera stream activity, preview dimensions, and a stable hold timer.
