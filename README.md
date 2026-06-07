# GazeTrack

Privacy-first, task-based webcam gaze analytics for website builders.

## Product overview
GazeTrack helps product teams run structured UX studies where testers complete tasks on a webpage while browser-based gaze estimation and interaction telemetry are captured. It focuses on actionable attention analytics (not medical eye tracking): AOI dwell, fixation timing, click-after-fixation behavior, task outcomes, and confidence-aware quality scoring.

## Target users
- Website builders and product designers validating key page flows
- UX researchers running lightweight remote studies
- Product analytics teams needing visual-attention context for behavior events

## MVP scope
- Study creation with task prompt + page URL/test page
- AOI (area of interest) definition as normalized 0-1 page regions
- Synthetic calibration step with five target points and generated error/confidence telemetry
- Session recording of rich synthetic gaze/click/scroll/task events in the current demo (no raw video)
- Tracker adapter boundary with synthetic telemetry as the default and an opt-in browser gaze experiment behind `VITE_ENABLE_WEBGAZER`
- Report with task counts, AOI metrics, fixation summary, event counts, privacy summary, and session quality verdict

## Tech stack
- Frontend: React + TypeScript + Vite
- Gaze tracking: planned browser-native integration such as WebGazer.js; current demo uses synthetic telemetry only
- Backend API: FastAPI (Python)
- Database: SQLite for local development, with a PostgreSQL/Supabase-compatible schema direction
- Analytics jobs: Python background jobs/tasks

## Local setup
1. Configure `.env` from `.env.example`. SQLite is used by default:

   ```bash
   cp .env.example .env
   ```

2. Install and run the FastAPI backend:

   ```bash
   cd backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   PYTHONPATH=. uvicorn app.main:app --reload
   ```

3. In a second terminal, install and run the Vite frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. Open `http://localhost:5173`, complete the synthetic demo session, and fetch the backend report.

The synthetic tracker is the default. To expose the experimental browser gaze mode locally, set:

```bash
VITE_ENABLE_WEBGAZER=true
```

The browser gaze option requires explicit in-app consent before initialization. It expects a guarded `window.webgazer`
global if you want to exercise the spike; normal synthetic mode does not load WebGazer or request camera permission.

The backend stores local demo data in `backend/gazetrack_demo.db` unless `GAZETRACK_DATABASE_URL` or `DATABASE_URL` is set. No Docker, Postgres, or Supabase instance is required for the current local demo.

## Demo flow
1. Backend initializes a default synthetic study with a task and demo AOIs.
2. Frontend displays the persisted task/AOI setup, then runs a synthetic-only calibration step.
3. Rich synthetic calibration/gaze/click/scroll/task events are ingested into SQLite.
4. Backend report generation computes event counts, task/AOI counts, AOI gaze/click metrics, demo-grade fixations, privacy summary, and quality summary.
5. Frontend renders the local demo report and the persisted backend report.

AOIs are normalized rectangles where `x` and `y` are top-left coordinates and `width`/`height` are dimensions from 0 to 1. Current AOIs are demo placeholders; screenshot uploads, DOM-derived AOIs, and webcam gaze estimation are future milestones. AOI dwell still includes the existing bounded-gap raw sample estimate, and reports now add fixation-derived dwell from a simple deterministic normalized-coordinate clustering algorithm. Fixation dwell is more meaningful than raw sample dwell, but it is still approximate and not medical-grade eye tracking or production fixation analytics.

The current demo generator can run `healthy`, `low_confidence`, `bad_calibration`, and `no_gaze` quality modes. These modes exist to exercise report quality verdicts and are not real tracker output. A frontend tracker adapter now separates this synthetic generator from the optional browser gaze spike. The browser gaze experiment is feature-flagged, approximate, not medical-grade eye tracking, and sends only normalized gaze telemetry, confidence/quality metadata, timestamps, clicks, scrolls, calibration events, and task events to the backend.

The current fixation detector is `simple_dispersion_v1`: accepted gaze samples are normalized to 0-1 coordinates, grouped when nearby in space and time, and promoted to a fixation only when the candidate has enough samples and duration. Calibration/session quality is a heuristic verdict (`pass`, `warn`, or `fail`) based on accepted gaze events, confidence, calibration errors when present, and whether fixations can be detected. WebGazer/browser webcam integration remains a future milestone, and the current calibration UI does not request camera permission.

## Privacy principles
- Process webcam frames locally in browser where possible.
- Store gaze/event telemetry only; do **not** store raw webcam video.
- Do **not** store webcam images, frames, screenshots, blobs, or base64 media payloads.
- Keep browser gaze tracking opt-in and require consent before camera-capable tracker initialization.
- Make calibration confidence and tracking quality explicit in reports.
- Communicate uncertainty; avoid claims of perfect accuracy.
- Use least-privilege data access and retention controls.

## Roadmap
- Phase 1: Workspace + data model + ingestion API scaffolding
- Phase 2: Browser tracker integration + calibration UX
- Phase 3: Event pipeline + quality-aware analytics metrics
- Phase 4: Research dashboard + report generation + replay
- Phase 5: Hardening, benchmarking, and deployment polish
