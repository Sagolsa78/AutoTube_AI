"""
pytest configuration for AutoTube AI test suite.
Sets asyncio_mode=auto so async test functions and fixtures work correctly.
"""
import pytest
import pytest_asyncio


# ── Global asyncio mode ───────────────────────────────────────────────────────
# All async tests and fixtures use the 'auto' mode to avoid needing decorators.
# This resolves the AssertionError in pytest_asyncio when using autouse async fixtures.


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "integration: marks tests that require real services")
    config.addinivalue_line("markers", "e2e: marks end-to-end tests")


# ── Shared fixtures ───────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"
