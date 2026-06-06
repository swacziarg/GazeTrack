# Interview Story: GazeOps

## Why I built it
I wanted a flagship portfolio project that combines full-stack product engineering with event modeling and analytics—close to real product/data work I want after graduation. GazeOps turns my analytics background into a shippable UX telemetry system with clear user value.

## Technical decisions
- Chose browser-native webcam gaze estimation (WebGazer.js style approach) for practical accessibility.
- Split architecture into capture, ingestion, analytics, and reporting layers for maintainability.
- Modeled append-only event tables plus derived report tables to mirror production analytics stacks.

## Tradeoffs
- Webcam gaze is noisier than dedicated hardware; quality scoring is mandatory.
- Prioritized trustworthy metrics and uncertainty communication over flashy but fragile features.
- Deferred complex auth/permissions to keep MVP focused on core study/report loop.

## Data quality challenges
- Calibration variability across lighting/devices.
- Coordinate drift with scrolling/responsive layouts.
- Separating true fixations from jitter/noise.
- Handling missing or low-confidence samples without misleading results.

## Privacy decisions
- Process webcam frames locally in-browser where possible.
- Store telemetry only (coordinates/events/confidence), never raw video.
- Treat data minimization and transparent confidence reporting as product features.

## Validation approach
- Validate ingestion with contract/integration tests.
- Validate metrics on deterministic sample sessions with expected outputs.
- Compare session quality bands against known-good/known-poor recording conditions.
- Manually test end-to-end flow: study -> calibration -> task -> report.

## What went wrong / likely risks
- Browser/device variability may reduce consistency.
- Metric thresholds may need iterative tuning to avoid false confidence.
- Heatmap/replay performance can degrade for high-volume sessions.

## Role alignment narrative
- **Data engineering:** Event schema design, ingestion reliability, derived metrics pipelines.
- **Product analytics:** Task funnel metrics, AOI attention metrics, quality-aware interpretation.
- **Internal tools/full-stack:** Study builder, researcher dashboards, session replay/report UX.

## Resume bullets (quantified placeholders)
- Built a privacy-first UX telemetry platform capturing **[X]+ events/session** across gaze, click, scroll, and task streams.
- Designed PostgreSQL schema and analytics pipeline powering **[Y] core attention metrics** and quality-aware reports.
- Implemented browser calibration + confidence scoring, improving usable session rate by **[Z]%**.
- Delivered end-to-end React/FastAPI product from study creation to replay/heatmap report in **[N] weeks**.
