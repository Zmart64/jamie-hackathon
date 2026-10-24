from pathlib import Path

import pytest
from attacker_agent.settings import Settings
from pydantic import HttpUrl, SecretStr


@pytest.fixture
def settings(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Settings:
    monkeypatch.setenv("SUPPORT_AGENT_ENV_FILE", str(tmp_path / "absent.env"))
    monkeypatch.delenv("ANTHROPIC_MODEL", raising=False)
    monkeypatch.delenv("SUPPORT_AGENT_CONFIG", raising=False)
    return Settings(
        model="abliterated-model-large-flash",
        reasoning_effort="none",
        api_key=SecretStr("test-only-placeholder"),
        provider_base_url=HttpUrl("https://attacker.test/v1"),
        target_base_url=HttpUrl("http://support.test"),
        log_dir=tmp_path / "events",
    )
