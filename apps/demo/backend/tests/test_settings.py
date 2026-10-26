from pathlib import Path

import pytest
from pydantic import ValidationError
from support_agent.api import create_app
from support_agent.settings import Settings, load_settings
from support_agent.store import SessionStore


def test_environment_overrides_dotenv_and_model_config(
    settings: Settings, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    env_file = tmp_path / "agent.env"
    env_file.write_text(
        "ANTHROPIC_API_KEY=dotenv-placeholder\nANTHROPIC_MODEL=dotenv-model\n", encoding="utf-8"
    )
    monkeypatch.setenv("SUPPORT_AGENT_ENV_FILE", str(env_file))
    from_dotenv = load_settings()
    assert from_dotenv.agent.model == "dotenv-model"
    assert from_dotenv.api_key is not None
    assert from_dotenv.api_key.get_secret_value() == "dotenv-placeholder"
    monkeypatch.setenv("ANTHROPIC_API_KEY", "environment-placeholder")
    monkeypatch.setenv("ANTHROPIC_MODEL", "environment-model")
    loaded = load_settings()
    assert loaded.agent.model == "environment-model"
    assert loaded.api_key is not None
    assert loaded.api_key.get_secret_value() == "environment-placeholder"
    assert "environment-placeholder" not in repr(loaded)
    assert settings.api_key is None


def test_custom_config_resolves_assets_relative_to_its_location(
    settings: Settings, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    config = tmp_path / "custom.toml"
    config.write_text(
        '[agent]\nmodel = "custom-model"\nsystem_prompt = "custom.md"\n'
        'accounts_file = "accounts.json"\n',
        encoding="utf-8",
    )
    (tmp_path / "custom.md").write_text("Custom support instructions.", encoding="utf-8")
    (tmp_path / "accounts.json").write_text(
        settings.agent.accounts_file.read_text(encoding="utf-8"), encoding="utf-8"
    )
    monkeypatch.setenv("SUPPORT_AGENT_CONFIG", str(config))
    monkeypatch.chdir(tmp_path.parent)
    loaded = load_settings()
    assert loaded.agent.system_prompt == tmp_path / "custom.md"
    assert loaded.agent.accounts_file == tmp_path / "accounts.json"
    assert loaded.agent.model == "custom-model"
    assert create_app(loaded).title == "Carbon Zero Support Agent"


def test_configuration_typos_fail_early(settings: Settings) -> None:
    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        Settings.model_validate({**settings.model_dump(), "modle": "typo"})


def test_empty_prompt_fails_at_startup(settings: Settings, tmp_path: Path) -> None:
    prompt = tmp_path / "empty.md"
    prompt.write_text("  \n", encoding="utf-8")
    altered = settings.model_copy(
        update={"agent": settings.agent.model_copy(update={"system_prompt": prompt})}
    )
    with pytest.raises(ValueError, match="prompt must not be empty"):
        create_app(altered)


def test_duplicate_account_ids_fail_at_startup(settings: Settings, tmp_path: Path) -> None:
    accounts_file = tmp_path / "accounts.json"
    accounts_file.write_text(
        settings.agent.accounts_file.read_text(encoding="utf-8").replace(
            "account-sam", "account-alex"
        ),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="IDs must be unique"):
        SessionStore(accounts_file, settings.agent.model)
