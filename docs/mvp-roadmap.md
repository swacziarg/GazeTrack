# 8-Week MVP Roadmap

## Week 1
- **Goal:** Repository/workspace foundation
- **Deliverables:** Docs baseline, folder structure, initial schema draft
- **Risks:** Over-scoping architecture early
- **Definition of done:** All core planning docs and conventions committed
- **Demo:** Walkthrough of spec, architecture, and data model

## Week 2
- **Goal:** Backend/API skeleton
- **Deliverables:** FastAPI app scaffolding, health endpoint, study/session CRUD stubs
- **Risks:** Contract churn before frontend alignment
- **Definition of done:** API skeleton runs locally with typed models
- **Demo:** Create/list studies and sessions via API

## Week 3
- **Goal:** Frontend shell + study builder UI
- **Deliverables:** React app scaffold, study/page/task forms, AOI editor MVP
- **Risks:** AOI UX complexity and coordinate normalization
- **Definition of done:** User can define study config end-to-end in UI
- **Demo:** Create a study and AOIs from browser UI

## Week 4
- **Goal:** Browser gaze capture + calibration
- **Deliverables:** WebGazer integration, calibration sequence, confidence capture
- **Risks:** Device/browser variability in signal quality
- **Definition of done:** Session records calibration outputs and basic gaze samples
- **Demo:** Live calibration and sample stream capture

## Week 5
- **Goal:** Event ingestion pipeline
- **Deliverables:** Batched ingestion endpoints, gaze/click/scroll/task persistence
- **Risks:** Throughput, ordering, and timestamp consistency
- **Definition of done:** End-to-end telemetry ingestion from tester flow
- **Demo:** Run task and inspect stored telemetry rows

## Week 6
- **Goal:** Analytics metrics engine
- **Deliverables:** Fixation extraction, AOI dwell/TTFF/CAF metrics, quality score logic
- **Risks:** Noisy gaze causing unstable metrics
- **Definition of done:** Deterministic metrics computed for sample sessions
- **Demo:** CLI/job output of computed session metrics

## Week 7
- **Goal:** Reporting and replay UI
- **Deliverables:** Session report page, heatmap rendering, replay timeline player
- **Risks:** Performance for dense sample sets
- **Definition of done:** One-click view of quality-aware session report
- **Demo:** Full report for at least one completed test session

## Week 8
- **Goal:** Polish, validation, and portfolio packaging
- **Deliverables:** QA pass, documentation updates, deployment notes, interview narrative
- **Risks:** Last-mile bugs and demo fragility
- **Definition of done:** Stable local demo and polished project story
- **Demo:** End-to-end showcase from study creation to report insights
