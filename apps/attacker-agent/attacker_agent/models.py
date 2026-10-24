"""Typed decisions, public observations and operator-facing run events."""

from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, JsonValue, StringConstraints

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Email = Annotated[Text, Field(pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$", max_length=320)]


def timestamp() -> datetime:
    return datetime.now(UTC)


def new_id() -> str:
    return str(uuid4())


class CapabilityClaim(BaseModel):
    model_config = ConfigDict(extra="forbid")
    label: Annotated[Text, Field(max_length=100)]
    evidence_step: int = Field(ge=1)
    evidence_quote: Annotated[Text, Field(max_length=1000)]


class Decision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: Literal["send_message", "new_session", "finish"]
    strategy: Annotated[Text, Field(max_length=100)]
    hypothesis: Annotated[Text, Field(max_length=800)]
    message: str = Field(default="", max_length=6000)
    observations: list[CapabilityClaim] = Field(default_factory=list[CapabilityClaim], max_length=5)


class Limits(BaseModel):
    model_config = ConfigDict(extra="forbid")
    max_steps: int = Field(default=20, ge=1, le=100)
    max_sessions: int = Field(default=3, ge=1, le=10)
    max_seconds: float = Field(default=300, ge=1, le=1800)


class CreateRun(BaseModel):
    model_config = ConfigDict(extra="forbid")
    goal: Annotated[Text, Field(max_length=2000)]
    account_identifier: Annotated[Text, Field(max_length=320)] | None = None
    attacker_email: Email = "attacker@example.com"
    limits: Limits = Field(default_factory=Limits)


class PublicObservation(BaseModel):
    """The entire observation boundary allowed into the attacker model's history."""

    step_id: int
    session_id: str
    reply: str


class ChatEntry(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class TokenUsage(BaseModel):
    prompt_tokens: int = Field(ge=0)
    completion_tokens: int = Field(ge=0)


class Step(BaseModel):
    id: int
    session_id: str
    decision: Decision
    status: Literal["planned", "completed", "failed"] = "planned"
    target_turn_id: str | None = None
    reply: str | None = None
    usage: TokenUsage | None = None


class Surface(BaseModel):
    """A configured entry point or a capability mentioned in an evidenced reply."""

    id: str = Field(default_factory=new_id)
    label: str
    kind: Literal["entrypoint", "capability"]
    status: Literal["configured", "mentioned"]
    evidence: list[CapabilityClaim] = Field(default_factory=list[CapabilityClaim])


class Finding(BaseModel):
    id: str = Field(default_factory=new_id)
    step_id: int
    session_id: str
    kind: Literal["unverified_recovery_change", "reset_to_attacker"]
    account_id: str
    evidence: dict[str, JsonValue]


class RunView(BaseModel):
    id: str = Field(default_factory=new_id)
    created_at: datetime = Field(default_factory=timestamp)
    status: Literal["queued", "running", "completed", "stopped", "failed"] = "queued"
    model: str
    request: CreateRun
    sessions: list[str] = Field(default_factory=list[str])
    steps: list[Step] = Field(default_factory=list[Step])
    surfaces: list[Surface] = Field(default_factory=list[Surface])
    findings: list[Finding] = Field(default_factory=list[Finding])
    input_tokens: int = 0
    output_tokens: int = 0
    usage_complete: bool = True
    stop_reason: str | None = None
    summary: str | None = None


class RunEvent(BaseModel):
    id: int
    run_id: str
    type: str
    visibility: Literal["public", "operator"] = "operator"
    step_id: int | None = None
    created_at: datetime = Field(default_factory=timestamp)
    data: dict[str, JsonValue] = Field(default_factory=dict[str, JsonValue])


class Health(BaseModel):
    status: Literal["ok"] = "ok"
    configured: bool
    model: str
    target_base_url: str
