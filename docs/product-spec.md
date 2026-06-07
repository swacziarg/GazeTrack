# Product Spec: GazeTrack

## Problem statement
Website builders often know what users clicked, but not what users *looked at* before acting. Existing tools underrepresent visual attention and rarely tie gaze behavior to explicit task goals. GazeTrack addresses this with privacy-first, task-based webcam gaze analytics and quality-aware reporting.

## User personas
1. **Indie Website Builder**: Needs fast feedback on whether visitors notice key CTAs.
2. **UX Researcher**: Runs structured task studies and compares performance across variants.
3. **Product Analyst**: Combines interaction telemetry with visual attention signals.

## Core workflows
- Create study with page/task setup
- Define AOIs on target page
- Run tester through calibration and task execution
- Ingest gaze + interaction events with confidence metadata
- Generate report with quality-aware metrics and replay

## MVP requirements
- Study management (basic CRUD)
- Task definition per study page
- AOI definition and storage
- Browser calibration flow with confidence/error capture
- Event ingestion endpoints for gaze/click/scroll/task events
- Session quality scoring
- Report view with heatmap + timeline replay + key metrics

## Non-goals
- Medical diagnostics or clinical claims
- Raw video collection/storage pipeline
- Advanced enterprise admin/permission systems in MVP
- Real-time collaborative annotation in first version

## Product differentiation
- Task-based analytics, not passive recordings alone
- Webcam gaze + interaction telemetry in one model
- First-class session quality/confidence scoring
- Privacy-first architecture that avoids raw video storage

## UX principles
- Clearly communicate confidence/limitations of tracking
- Keep setup friction low (quick calibration and start)
- Make reports interpretable by non-experts
- Prioritize actionable metrics over novelty visuals

## Study creation flow
1. Create study (name, objective, target audience notes)
2. Add one or more study pages (URL or built-in test page)
3. Add task prompt(s) and success criteria
4. Define AOIs on page image/DOM snapshot
5. Generate tester link/session invite

## Tester flow
1. Consent + webcam permission prompt
2. Calibration sequence
3. Quality gate/check (retry if below threshold)
4. Task prompt shown
5. Interaction period with event capture
6. Task completion + optional confidence survey

## Researcher dashboard flow
1. Open study summary (session counts, quality distribution)
2. Filter sessions by quality/task outcome/device
3. Compare AOI metrics across sessions
4. Open individual replay for deep inspection

## Report flow
1. Session-level quality summary
2. Task outcome/timing summary
3. AOI metrics (dwell, TTFF, fixation count, CAF delay)
4. Heatmap view
5. Schematic normalized-coordinate replay with AOI boxes, gaze samples, fixation centroids, click markers, and task/scroll markers
6. Replay timeline export and shareable report snapshot

## Future stretch features
- Multi-page funnel studies
- Variant/AB comparison and significance helpers
- AOI auto-suggestions from DOM semantics
- Team collaboration annotations
- Scheduled recurring benchmark studies
