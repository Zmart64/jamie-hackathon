"""Load explicit runtime settings; resolve asset paths relative to the config."""

import os
import tomllib
from pathlib import Path

from dotenv import dotenv_values
from pydantic import BaseModel, ConfigDict, Field, SecretStr

PACKAGE_DIR = Path(__file__).resolve().parent


class AgentSettings(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    model: str = Field(min_length=1)
    system_prompt: Path
    accounts_file: Path
    max_output_tokens: int = Field(default=2048, ge=128)
    max_model_steps_per_turn: int = Field(default=8, ge=1, le=50)
    request_timeout_seconds: float = Field(default=30.0, gt=0, le=300)


class ServerSettings(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    host: str = "127.0.0.1"
    port: int = Field(default=8000, ge=1, le=65535)
    allowed_origins: list[str] = Field(default_factory=list[str])


class Settings(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    agent: AgentSettings
    server: ServerSettings = Field(default_factory=ServerSettings)
    api_key: SecretStr | None = Field(default=None, repr=False)


def load_settings(config_path: Path | None = None) -> Settings:
    """Read TOML and optional dotenv values without modifying process environment."""
    env_file = Path(os.environ.get("SUPPORT_AGENT_ENV_FILE", PACKAGE_DIR.parent / ".env"))
    environment = {**dotenv_values(env_file), **os.environ}
    config_path = config_path or Path(
        environment.get("SUPPORT_AGENT_CONFIG") or PACKAGE_DIR / "config.toml"
    )
    config_path = config_path.expanduser().resolve()
    with config_path.open("rb") as handle:
        settings = Settings.model_validate(tomllib.load(handle))
    agent = settings.agent.model_dump()
    agent["model"] = environment.get("ANTHROPIC_MODEL") or settings.agent.model
    for field in ("system_prompt", "accounts_file"):
        agent[field] = (config_path.parent / agent[field]).resolve()
    api_key = (environment.get("ANTHROPIC_API_KEY") or "").strip()
    return Settings(
        agent=AgentSettings.model_validate(agent),
        server=settings.server,
        api_key=SecretStr(api_key) if api_key else None,
    )
