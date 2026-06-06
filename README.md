# GazeOps

Privacy-first, task-based webcam gaze analytics for website builders.

## Product overview
GazeOps helps product teams run structured UX studies where testers complete tasks on a webpage while browser-based gaze estimation and interaction telemetry are captured. It focuses on actionable attention analytics (not medical eye tracking): AOI dwell, fixation timing, click-after-fixation behavior, task outcomes, and confidence-aware quality scoring.

## Current status
This repository is currently scaffold-first:
- implementation-ready docs and contracts
- synthetic sample payloads for safe iteration
- no production webcam tracking, auth, or persistence wiring yet

## Safe development principles
- Process webcam frames locally in browser where possible.
- Store gaze/event telemetry only; do **not** store raw webcam video.
- Treat gaze telemetry as sensitive behavioral data.
- Communicate uncertainty; avoid claims of perfect or medical-grade accuracy.
- Prefer conservative, low-risk, reviewable increments.

## Repository structure
```text
.github/                  PR + issue templates
contracts/                JSON Schema draft contracts
docs/                     product, architecture, workflow, and checklists
backend/                  backend placeholder notes
frontend/                 frontend placeholder notes
sample-data/              synthetic study/session payloads
scripts/                  lightweight validation utilities
```

## Documentation index
- Product and system docs:
  - `docs/product-spec.md`
  - `docs/architecture.md`
  - `docs/data-model.md`
  - `docs/analytics-metrics.md`
  - `docs/mvp-roadmap.md`
- Development and safety:
  - `CONTRIBUTING.md`
  - `docs/development-workflow.md`
  - `docs/privacy-and-safety.md`
  - `docs/ux-study-lifecycle.md`
  - `docs/api-contracts.md`
- Implementation checklists:
  - `docs/checklists/mvp-implementation-checklist.md`
  - `docs/checklists/gaze-tracking-integration-checklist.md`
  - `docs/checklists/reporting-analytics-checklist.md`
  - `docs/checklists/release-readiness-checklist.md`

## Contracts and sample data
- Draft schemas live in `contracts/`.
- Synthetic examples live in `sample-data/`.
- Validate sample JSON with:

```bash
python scripts/validate_sample_data.py
```

## MVP scope (still planned)
- Study creation with task prompt + page URL/test page
- AOI definition on page screenshots/layout
- Calibration and quality/confidence capture
- Session telemetry ingestion (gaze/click/scroll/task)
- Report generation with quality-aware metrics

## Intentionally not implemented in this phase
- Webcam tracking integration
- Authentication
- Database persistence wiring
- Payment/deployment automation
- Advanced analytics/replay/heatmap runtime features

## Next milestones
1. Add backend FastAPI stubs matching `docs/api-contracts.md`.
2. Add frontend static placeholders for study/calibration/report flows.
3. Add schema validation hooks in CI and basic contract tests.
