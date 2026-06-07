import os
import tempfile
from pathlib import Path

import pytest

TEST_DATABASE_PATH = Path(tempfile.mkdtemp(prefix="gazetrack-tests-")) / "gazetrack_test.db"
os.environ["GAZETRACK_DATABASE_URL"] = f"sqlite:///{TEST_DATABASE_PATH}"

from app.db import reset_database  # noqa: E402


@pytest.fixture(autouse=True)
def reset_demo_database() -> None:
    reset_database()
    yield
    reset_database()
