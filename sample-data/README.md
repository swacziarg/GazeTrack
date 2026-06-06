# Sample Data

Synthetic, privacy-safe payloads for contract validation and future UI/backend scaffolding.

## Files
- `study-basic-landing-page.json` — baseline study definition with one page and AOIs.
- `session-good-quality.json` — complete task with high confidence and strong quality score.
- `session-poor-calibration.json` — low-confidence session showing poor calibration/tracking quality.
- `session-cta-ignored.json` — session where tester never fixates/clicks primary CTA and abandons task.

## Usage
- Use for API contract examples and report payload previews.
- Use with `scripts/validate_sample_data.py` for basic static checks.

## Privacy note
These files are synthetic. They contain no webcam frames, no image blobs, and no personal data.
