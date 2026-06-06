# Privacy and Safety Principles

GazeOps is privacy-first by design.

## Core handling rules
- Webcam frames should be processed locally in-browser whenever possible.
- Raw webcam video storage is not part of the default architecture.
- Persist only telemetry needed for UX analysis (for example gaze coordinates, confidence, interaction events, and session quality metadata).

## Sensitivity model
Gaze coordinates and related interaction streams are sensitive behavioral telemetry. They can reveal attention patterns and intent, so collection and retention must stay minimal and purpose-bound.

## Product principles
- **Consent:** testers should be informed before telemetry capture begins.
- **Transparency:** clearly describe what is collected and what is not.
- **Deletion:** support data deletion/retention controls in implementation phases.
- **Data minimization:** collect only fields required for study outcomes and quality checks.

## Safety and claim boundaries
- Do not present gaze output as medical, diagnostic, or clinical-grade.
- Communicate confidence/quality limits explicitly in UX and reporting.
- Avoid deterministic claims when signal quality is low.
