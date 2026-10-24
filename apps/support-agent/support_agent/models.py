"""Public API models and the small mock business data model."""

from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, JsonValue, StringConstraints

Email = Annotated[
    str, StringConstraints(strip_whitespace=True, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
]
NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


def new_id() -> str:
    return str(uuid4())


def timestamp() -> datetime:
    return datetime.now(UTC)


class Account(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: NonEmptyText
    username: NonEmptyText
    display_name: NonEmptyText
    email: Email
    recovery_email: Email
    verification_code: NonEmptyText


class CreateSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    account_identifier: Annotated[NonEmptyText, Field(max_length=320)] | None = None


class SendMessageRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    message: Annotated[NonEmptyText, Field(max_length=20000)]


class ChatMessage(BaseModel):
    id: str = Field(default_factory=new_id)
    turn_id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime = Field(default_factory=timestamp)


class ToolEvent(BaseModel):
    type: Literal["tool_call"] = "tool_call"
    id: str = Field(default_factory=new_id)
    turn_id: str
    tool_call_id: str
    name: str
    arguments: JsonValue
    result: JsonValue
    is_error: bool = False
    created_at: datetime = Field(default_factory=timestamp)


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    """Request failures that happen before a conversation turn starts."""

    error: ErrorDetail


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    model: str
    configured: bool


class Turn(BaseModel):
    """One submitted user message and its reply, including observable tool receipts."""

    session_id: str
    turn_id: str = Field(default_factory=new_id)
    status: Literal["completed", "failed"] = "completed"
    reply: str | None = None
    reply_source: Literal["model", "refusal_fallback"] = "model"
    messages: list[ChatMessage] = Field(default_factory=list[ChatMessage])
    tool_events: list[ToolEvent] = Field(
        default_factory=list[ToolEvent],
        description="Ordered tool attempts and their actual results; includes failed attempts.",
    )
    error: ErrorDetail | None = None


class SessionInfo(BaseModel):
    session_id: str
    model: str
    account_identifier: str | None
    created_at: datetime


class Conversation(SessionInfo):
    messages: list[ChatMessage]
    turns: list[Turn]


class MockEmail(BaseModel):
    id: str = Field(default_factory=new_id)
    account_id: str
    to: str
    subject: str = "Reset your Carbon Zero password"
    reset_url: str
    created_at: datetime = Field(default_factory=timestamp)


class AccountSnapshot(BaseModel):
    id: str
    email: str
    recovery_email: str
    verified: bool


class MockStateSnapshot(BaseModel):
    session_id: str
    accounts: list[AccountSnapshot]
    outbox: list[MockEmail]
