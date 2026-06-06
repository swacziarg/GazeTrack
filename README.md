# GazeOps

Privacy-first, task-based webcam gaze analytics for website builders.

## Product overview
GazeOps helps product teams run structured UX studies where testers complete tasks on a webpage while browser-based gaze estimation and interaction telemetry are captured. It focuses on actionable attention analytics (not medical eye tracking): AOI dwell, fixation timing, click-after-fixation behavior, task outcomes, and confidence-aware quality scoring.

## Target users
- Website builders and product designers validating key page flows
- UX researchers running lightweight remote studies
- Product analytics teams needing visual-attention context for behavior events

## MVP scope
- Study creation with task prompt + page URL/test page
- AOI (area of interest) definition on page screenshots/layout
- Browser calibration and quality/confidence capture
- Session recording of gaze/click/scroll/task events (no raw video)
- Report with heatmap, replay timeline, task timing, AOI metrics, and session quality score

## Tech stack
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Gaze tracking: WebGazer.js (or equivalent browser-native library)
- Backend API: FastAPI (Python)
- Database: PostgreSQL (Supabase-compatible schema)
- Analytics jobs: Python background jobs/tasks

## Local setup (placeholder)
1. Configure `.env` from `.env.example`.
2. Start PostgreSQL/Supabase local instance.
3. Run backend server.
4. Run frontend dev server.
5. Open app and run a sample study.

(Concrete commands will be added as services are scaffolded.)

## Demo flow
1. Researcher creates study and adds page + task.
2. Researcher marks AOIs (hero CTA, pricing, nav, etc.).
3. Tester calibrates webcam tracking in browser.
4. Tester performs task while gaze + event telemetry is captured.
5. Researcher reviews heatmap, replay, quality score, and task metrics.

## Privacy principles
- Process webcam frames locally in browser where possible.
- Store gaze/event telemetry only; do **not** store raw webcam video.
- Make calibration confidence and tracking quality explicit in reports.
- Communicate uncertainty; avoid claims of perfect accuracy.
- Use least-privilege data access and retention controls.

## Roadmap
- Phase 1: Workspace + data model + ingestion API scaffolding
- Phase 2: Browser tracker integration + calibration UX
- Phase 3: Event pipeline + quality-aware analytics metrics
- Phase 4: Research dashboard + report generation + replay
- Phase 5: Hardening, benchmarking, and deployment polish
