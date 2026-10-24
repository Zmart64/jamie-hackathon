from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from support_agent.api import create_app
from support_agent.settings import Settings, load_settings

from .helpers import ClaudeStub


@pytest.fixture
def settings(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Settings:
    for key in ("ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "SUPPORT_AGENT_CONFIG"):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("SUPPORT_AGENT_ENV_FILE", str(tmp_path / "absent.env"))
    return load_settings()


@pytest.fixture
def claude() -> Generator[ClaudeStub]:
    stub = ClaudeStub()
    yield stub
    stub.client.close()


@pytest.fixture
def api(settings: Settings, claude: ClaudeStub) -> Generator[TestClient]:
    with TestClient(create_app(settings, claude.client)) as client:
        yield client
