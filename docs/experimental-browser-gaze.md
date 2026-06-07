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
- Hides WebGazer's local camera preview and prediction points.
- Shows a five-point calibration overlay.
- Samples approximate predictions at a throttled interval.
- Emits compatible telemetry such as normalized gaze points, confidence/quality metadata, timestamps, calibration events, task events, clicks, and scrolls.
- Shows local status, weak-signal, and calibration feedback.

## What it does not do

- It does not make GazeTrack medical-grade.
- It does not guarantee accurate gaze position.
- It does not upload raw webcam video.
- It does not persist frames, screenshots, image blobs, or base64 media.
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
