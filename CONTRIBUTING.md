# Contributing to GazeOps

Thanks for contributing. Keep changes focused, reviewable, and privacy-first.

## Safe change guidelines
- Prefer small PRs with one clear goal.
- Avoid risky implementation jumps in early scaffolding phases.
- Keep telemetry-focused design; do not add raw webcam video handling.
- Do not make medical/clinical accuracy claims.
- Update docs/contracts/sample data together when interfaces change.

## Branch naming suggestions
Use concise, descriptive branch names, for example:
- `docs/privacy-safety-refresh`
- `contracts/events-schema-draft`
- `scaffold/github-templates`

## Commit message suggestions
Use imperative, scoped messages:
- `docs: add privacy and safety guide`
- `contracts: add draft event and report schemas`
- `sample-data: add quality scenario sessions`

## Pull request checklist
- [ ] Change scope is clear and minimal
- [ ] No raw webcam video storage introduced
- [ ] No overclaiming gaze accuracy
- [ ] Docs updated for interface/contract changes
- [ ] Sample data updated when event shapes changed
- [ ] Basic validation steps documented in PR notes

## Follow AGENTS.md
Before opening a PR, review `/tmp/workspace/swacziarg/GazeTrack/AGENTS.md` and confirm your changes align with project mission, constraints, and conventions.
