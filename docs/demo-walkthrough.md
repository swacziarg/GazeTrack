# Demo Walkthrough

Use this walkthrough when showing GazeTrack to a recruiter, interviewer, or engineering reviewer. The default path is synthetic because it is deterministic, privacy-safe, and does not depend on camera permission.

## 1. Start the local stack

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## 2. Explain the project boundary

Start with this positioning:

> GazeTrack is a privacy-first task analytics demo. The implemented demo uses synthetic gaze-like telemetry by default, persists only telemetry, and generates backend reports from SQLite. It is not medical-grade eye tracking and does not store webcam video.

Call out the in-app Demo Guide before starting the session.

## 3. Configure or review the study

In the study preview and builder, review:

- Study name and objective.
- Target URL or page label.
- Task prompt.
- AOIs as normalized 0-1 rectangles.
- AOI semantic labels such as CTA, nav, pricing, hero, or form.

Keep changes small during a live demo. The point is to show explicit task/AOI contracts, not a production study-authoring suite.

## 4. Run the recommended synthetic session

1. Click `Open demo study`.
2. Keep `Telemetry source` set to `Synthetic demo`.
3. Choose `Healthy` demo quality mode unless you want to show quality warnings.
4. Click `Start demo session`.
5. Click `Run synthetic calibration`.
6. Wait until all deterministic events have played.
7. Click `Complete demo session`.

Synthetic mode should not request camera permission.

## 5. Inspect ingest and report output

In the local report and backend report, point out:

- Accepted/rejected/stored ingest counts.
- Tracker mode and tracker type.
- Executive summary bullets, quality interpretation, AOI attention ranking, and recommended next actions.
- First noticed, most attended, and weak/ignored AOI callouts.
- Event type counts.
- AOI gaze samples, clicks, fixation counts, fixation dwell, TTFF, attention share, and CAF-style click-after-fixation delay when available.
- Quality verdict and quality reasons.
- Privacy summary showing raw media is not stored.
- Schematic replay generated from telemetry, not video or screenshots.

## 6. Optional browser gaze experiment

Only show this if you explicitly want to discuss future browser-native gaze work:

```bash
cd frontend
VITE_ENABLE_WEBGAZER=true npm run dev
```

Then choose `Browser gaze experiment`, read the consent notice, grant consent, allow camera permission, and run calibration. Explain that this path is approximate, browser-dependent, quality-gated, opt-in, and not part of the default synthetic demo.

If the tracker fails or quality is weak, use the fallback button. That is expected behavior for an experimental path.

## Screenshot / GIF slots

Future portfolio media can be added under `docs/assets/`:

- `demo-guide.png`: first viewport with Demo Guide and privacy copy.
- `study-builder.png`: configured study/tasks/AOIs.
- `synthetic-session.gif`: default synthetic session flow.
- `synthetic-report.png`: default synthetic report with quality-aware AOI insights.
- `backend-report-insights.png`: persisted telemetry report, AOI ranking, and recommendations.
- `browser-gaze-consent.png`: optional consent panel.
- `browser-gaze-debug.gif`: optional approximate gaze debug overlay.

Do not include real webcam frames or private user data in demo assets.
