#!/usr/bin/env python3
"""Lightweight JSON validation for sample-data payloads."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
SAMPLE_DIR = REPO_ROOT / "sample-data"

REQUIRED_BY_FILE: Dict[str, List[str]] = {
    "study-basic-landing-page.json": ["study_id", "name", "pages", "session"],
    "session-good-quality.json": ["session_id", "study_id", "events", "quality", "report_summary"],
    "session-poor-calibration.json": ["session_id", "study_id", "events", "quality", "report_summary"],
    "session-cta-ignored.json": ["session_id", "study_id", "events", "quality", "report_summary"],
}


def validate_file(path: Path) -> Tuple[bool, str]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - explicit failure message
        return False, f"invalid JSON ({exc})"

    if not isinstance(data, dict):
        return False, "top-level value must be an object"

    required_fields = REQUIRED_BY_FILE.get(path.name, [])
    missing = [field for field in required_fields if field not in data]
    if missing:
        return False, f"missing required top-level fields: {', '.join(missing)}"

    return True, "ok"


def main() -> int:
    if not SAMPLE_DIR.exists():
        print(f"ERROR: sample-data directory not found at {SAMPLE_DIR}")
        return 1

    json_files = sorted(p for p in SAMPLE_DIR.glob("*.json") if p.is_file())
    if not json_files:
        print("ERROR: no JSON files found in sample-data/")
        return 1

    failures: List[Tuple[str, str]] = []
    for file_path in json_files:
        ok, message = validate_file(file_path)
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {file_path.name}: {message}")
        if not ok:
            failures.append((file_path.name, message))

    print("\nSummary")
    print(f"- Files checked: {len(json_files)}")
    print(f"- Passed: {len(json_files) - len(failures)}")
    print(f"- Failed: {len(failures)}")

    if failures:
        print("\nFailures:")
        for name, reason in failures:
            print(f"- {name}: {reason}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
