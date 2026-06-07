# GazeTrack

Privacy-first synthetic telemetry demo pipeline for task-based website UX testing.

## Current status

GazeTrack is currently a safe full-stack demo that shows the shape of a product/data pipeline for task-based UX studies. The default experience uses synthetic calibration, gaze, click, scroll, and task events; persists privacy-safe telemetry in SQLite; and generates a local report plus a backend report from stored demo data.

The repository currently has a `v0.1-demo` Git tag, verified with `git tag --list` on 2026-06-07. Check tags, test results, and release notes in the current checkout before relying on release status.

This demo is not production webcam eye tracking. Browser gaze estimation is present only as an experimental, feature-flagged spike behind `VITE_ENABLE_WEBGAZER`, explicit consent, and guarded `window.webgazer` access. WebGazer is not bundled, and the project does not claim medical-grade accuracy, biometric identity, real heatmaps, screenshot replay, DOM AOI detection, CAF delay, auth, deployment, export, or sharing.

## Target users

- Website builders and product designers evaluating a product/data pipeline concept for task-based UX studies
- UX researchers reviewing how quality-aware attention telemetry could be modeled
- Product analytics teams interested in event contracts, privacy constraints, and report generation patterns

## Current `v0.1-demo` scope

- React + TypeScript + Vite demo dashboard
- Default `SyntheticTracker` with `healthy`, `low_confidence`, `bad_calibration`, and `no_gaze` quality modes
- Synthetic five-point calibration and synthetic task session flow
- FastAPI + SQLite persistence for studies, tasks, AOIs, sessions, accepted telemetry events, and persisted report payloads
- Backend ingestion validation with recursive rejection of media-like payload keys
- Report helpers/services for event counts, AOI hit metrics, bounded raw dwell, `simple_dispersion_v1` demo fixations, TTFF from task start, quality verdicts, and schematic replay payloads
- Frontend local report, backend ingest/report panels, and normalized-coordinate schematic replay visuals

## Experimental browser gaze spike

The optional `WebGazerTracker` path can be exposed locally with:

```bash
VITE_ENABLE_WEBGAZER=true
```

When enabled, the UI labels it as a browser gaze experiment and requires explicit consent before initialization. The adapter is guarded against missing `window.webgazer` and sends only compatible privacy-safe telemetry fields such as normalized gaze points, optional confidence/quality metadata, timestamps, clicks, scrolls, calibration events, and task events.

It is not bundled, not part of the default demo path, and does not provide evidence of production real gaze tracking.

## Tech stack

- Frontend: React + TypeScript + Vite
- Tracker path: synthetic telemetry by default; optional browser gaze spike behind a feature flag
- Backend API: FastAPI (Python)
- Database: SQLite for local demo persistence, with a PostgreSQL/Supabase-compatible schema direction documented separately
- Reporting: Python report helpers/services invoked by API routes

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

The backend stores local demo data in `backend/gazetrack_demo.db` unless `GAZETRACK_DATABASE_URL` or `DATABASE_URL` is set. This SQLite file is local state, not a release artifact. No Docker, Postgres, Supabase, webcam permission, or bundled WebGazer dependency is required for the current demo.

## Demo flow

1. Backend initializes a default synthetic study with one task and demo AOIs.
2. Frontend displays the persisted task/AOI setup, then runs a synthetic-only calibration step.
3. Rich synthetic calibration/gaze/click/scroll/task events are ingested into SQLite.
4. Backend report generation computes event counts, task/AOI counts, AOI gaze/click metrics, demo-grade fixations, TTFF from task start, replay overlay data, privacy summary, and quality summary.
5. Frontend renders the local demo report and the persisted backend report, including a normalized-coordinate AOI/gaze/fixation/click replay when persisted replay data exists.

AOIs are normalized rectangles where `x` and `y` are top-left coordinates and `width`/`height` are dimensions from 0 to 1. Current AOIs are demo placeholders. Screenshot uploads, DOM-derived AOIs, production webcam gaze estimation, and CAF delay are not currently implemented; they are possible future directions.

The current fixation detector is `simple_dispersion_v1`: accepted gaze samples are normalized to 0-1 coordinates, grouped when nearby in space and time, and promoted to a fixation only when the candidate has enough samples and duration. Calibration/session quality is a heuristic verdict (`pass`, `warn`, or `fail`) based on accepted gaze events, confidence, calibration errors when present, and whether fixations can be detected. These analytics are deterministic demo helpers, not production fixation analytics or medical-grade eye tracking.

Backend replay is a static schematic generated from persisted telemetry and computed fixation centroids. It does not use video, screenshots, raw webcam frames, images, blobs, base64 media, or a production replay engine.

## Privacy principles

- Synthetic mode must not request camera permission.
- Optional browser gaze experiments must be opt-in and consent-gated.
- Process webcam frames locally in browser where future tracker work requires camera access.
- Store gaze/event telemetry only; do **not** store raw webcam video.
- Do **not** store webcam images, frames, screenshots, blobs, or base64 media payloads.
- Make calibration confidence and tracking quality explicit in reports.
- Communicate uncertainty; avoid claims of perfect accuracy, biometric identity, or medical use.
- Use least-privilege data access patterns and plan retention/deletion controls before production use.

## Local validation

See [docs/v0.1-demo-release-checklist.md](docs/v0.1-demo-release-checklist.md) for local validation notes. Those notes are evidence-scoped, not a general release-readiness claim.

Validation commands:

- Backend unit/integration tests and report schema validation:

  ```bash
  cd backend
  python -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  PYTHONPATH=. pytest
  PYTHONPATH=. pytest tests/test_session_report_schema_contract.py
  ```

- Frontend unit tests, build, and synthetic E2E happy path:

  ```bash
  cd frontend
  npm install
  npx playwright install chromium
  npm test
  npm run build
  npm run e2e
  ```

Run these commands in the current environment before relying on a checkout's status. Run the E2E after the backend `.venv` exists and `backend/requirements.txt` has been installed. The E2E starts a local
FastAPI backend and Vite frontend, keeps the default synthetic tracker selected, runs the synthetic session, and verifies
successful backend ingest/report UI. It does not enable WebGazer.

## Possible future directions

See [docs/mvp-roadmap.md](docs/mvp-roadmap.md) for the current documented state, validation evidence, non-goals, and possible future directions. Candidate directions include configurable study setup, stronger privacy regression tests, multi-session reporting, metrics evolution, browser gaze research mode, and production hardening.
