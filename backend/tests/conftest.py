import pytest

from app.services.session_store import reset_store


@pytest.fixture(autouse=True)
def reset_demo_session_store() -> None:
    reset_store()
    yield
    reset_store()
