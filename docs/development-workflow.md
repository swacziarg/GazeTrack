# Development Workflow (Draft)

## Local development overview
Current repository state is scaffold-first. Prioritize contracts, docs, and synthetic data over risky implementation.

Suggested flow:
1. Review `AGENTS.md` and relevant docs.
2. Update contracts/docs/sample data for the target change.
3. Add lightweight stubs/placeholders only when the base app exists.
4. Run available validation scripts/tests.
5. Open a focused PR with privacy impact notes.

## Frontend vs backend responsibilities
- **Frontend:** study setup UX, calibration/task flows, telemetry capture UX, report presentation.
- **Backend:** API contracts, ingestion validation, session/report orchestration, analytics computation hooks.
- **Shared contracts:** JSON schemas and sample payloads must stay aligned between both layers.

## How mock data should be used
- Keep all mock data synthetic and privacy-safe.
- Use mock sessions to validate parsing, shape checks, and report rendering assumptions.
- Version/update sample files whenever event or report shapes change.

## Future migration handling
- Treat schema changes as explicit, reviewable steps.
- Add migration drafts with rollback notes once DB wiring exists.
- Avoid destructive migrations without documented data transition plans.

## Adding event types safely
1. Document the new event in `docs/event-taxonomy.md` (or add draft if missing).
2. Update `contracts/events.schema.json` with required/optional fields.
3. Add/update sample-data files demonstrating the new shape.
4. Add/update validation checks for required top-level fields.
5. Call out compatibility notes in PR description.
