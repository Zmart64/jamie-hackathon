"""App-local secrets and configuration; target endpoints are server-owned."""

import os
import tomllib
from pathlib import Path

from dotenv import dotenv_values
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, SecretStr

PACKAGE_DIR = Path(__file__).resolve().parent


class Settings(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    model: str = "abliterated-model-large-flash"
    provider_base_url: HttpUrl = HttpUrl("https://api.abliteration.ai/v1")
    target_base_url: HttpUrl = HttpUrl("http://127.0.0.1:8000")
    max_output_tokens: int = Field(default=4096, ge=256, le=16000)
    max_context_chars: int = Field(default=100000, ge=1000, le=500000)
    request_timeout_seconds: float = Field(default=60, gt=0, le=300)
    host: str = "127.0.0.1"
    port: int = Field(default=8001, ge=1, le=65535)
    allowed_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )
    log_dir: Path = PACKAGE_DIR.parents[2] / ".runs" / "attacker"
    api_key: SecretStr | None = Field(default=None, repr=False, exclude=True)


def load_settings(config_path: Path | None = None) -> Settings:
    env_file = Path(os.environ.get("ATTACKER_ENV_FILE", PACKAGE_DIR.parent / ".env"))
    environment = {**dotenv_values(env_file), **os.environ}
    config_path = config_path or Path(
        environment.get("ATTACKER_CONFIG") or PACKAGE_DIR / "config.toml"
    )
    config_path = config_path.expanduser().resolve()
    with config_path.open("rb") as handle:
        values = tomllib.load(handle)
    settings = Settings.model_validate(values)
    overrides: dict[str, object] = settings.model_dump()
    overrides["model"] = environment.get("ATTACKER_MODEL") or settings.model
    overrides["target_base_url"] = (
        environment.get("ATTACKER_TARGET_URL") or settings.target_base_url
    )
    overrides["log_dir"] = (config_path.parent / settings.log_dir).resolve()
    key = (environment.get("ABLITERATION_API_KEY") or "").strip()
    overrides["api_key"] = SecretStr(key) if key else None
    return Settings.model_validate(overrides)
