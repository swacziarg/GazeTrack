# Release 003 Checklist: Website Integration MVP

Release 003 makes controlled-site website integration credible, repeatable, privacy-safe, and API-shaped while preserving the synthetic demo path.

## Shipped Capabilities

- [x] Versioned SDK URL: `/sdk/v0.2/gazetrack-capture.js`.
- [x] Legacy SDK URL preserved: `/gazetrack-capture.js`.
- [x] Dedicated public capture API namespace under `/api/v1/capture/...`.
- [x] Capture token required for public capture config, session, AOI snapshot, event ingest, and complete calls.
- [x] Per-study `allowed_origins` persisted and enforced for public capture requests when configured.
- [x] Capture token rotation endpoint for local/demo-admin revoke posture.
- [x] SDK event batches include opaque `batch_id` and per-event `client_event_id`.
- [x] Backend skips duplicate `(session_id, client_event_id)` events and reports accepted, rejected, duplicate, and skipped counts.
- [x] SDK periodically flushes active sessions, retries transient failures, keeps queued events until acknowledgement, and attempts lifecycle flush with `sendBeacon` or `keepalive`.
- [x] Real-site layout capture omits arbitrary DOM text by default.
- [x] `captureText`, `captureCssMetadata`, `allowedTextSelectors`, and `redactSelectors` are documented SDK options.
- [x] Dashboard Website integration panel shows the versioned snippet, capture token, target URL, AOI selectors/role keys, allowed origins, and readiness checklist.
- [x] Install verification endpoint returns the expected script URL, current study configuration, AOI selectors, allowed origins, and recommended snippet.

## Privacy Assertions

- [x] Interaction-only capture is the default for controlled websites.
- [x] WebGazer remains optional, experimental, consent/config gated, approximate, and not medical-grade.
- [x] Raw webcam video, frames, screenshots, image blobs, base64 media, face embeddings, and face landmarks are not valid stored telemetry.
- [x] Inputs, textareas, password fields, and redacted selectors never contribute stored DOM text.
- [x] AOI labels may be stored because they are configured by the study owner.
- [x] Origin allowlists and capture tokens are documented as defense-in-depth, not full authentication.
- [x] Token retrieval, install verification, and token rotation are documented as local/demo-admin APIs until auth exists.

## Documentation Checklist

- [x] README describes real-site capture as implemented, not merely future work.
- [x] README includes a minimal `/sdk/v0.2/gazetrack-capture.js` integration snippet.
- [x] API contracts document the public capture endpoints and request/response shapes.
- [x] Privacy model documents interaction-only default, DOM text defaults, token/origin controls, and idempotent flush metadata.
- [x] Roadmap and product spec describe Release 003 state and move remaining hardening to Release 004/future.
- [x] Troubleshooting covers CORS/origin mismatch, invalid token, AOI not detected, iframe blocked in report view, and backend unavailable.

## Validation Commands

Ticket 10 should run the full validation suite in a clean checkout:

```bash
cd backend && PYTHONPATH=. pytest
cd ../frontend && npm test
npm run build
npm run e2e
```

Ticket 9 docs validation:

```bash
git diff --check
rg -n "future|v0.1-demo|safe text snippets|CAF delay|production-grade|medical-grade|screenshot|raw video|future work|not implemented" README.md docs backend/README.md frontend/README.md
```

## Known Limitations

- No dashboard authentication or team permission model yet.
- Capture tokens are integration credentials, not user authentication.
- Empty `allowed_origins` preserves local/demo behavior and is intentionally permissive.
- Browser `Origin` is a useful browser signal, not a cryptographic identity proof.
- Install verification is a readiness helper, not a remote crawler, scanner, screenshotter, or target-site auditor.
- WebGazer accuracy is not validated for production or medical use.
- Reports use deterministic/demo-grade fixation and quality heuristics.
- Replay is schematic telemetry playback, not video or screenshot replay.
- SQLite remains the local persistence layer.

## Release 004 Follow-Ups

- Add authenticated dashboard/admin controls before production use of snippet config, install verification, and token rotation.
- Add retention/deletion workflows and clearer tester consent records.
- Add multi-session study summaries and task success comparisons.
- Expand privacy regression tests for lifecycle flush payloads and layout snapshots.
- Improve AOI authoring with selector/DOM assistance while avoiding screenshot/media persistence.
- Validate browser gaze quality thresholds before expanding WebGazer beyond experimental status.
