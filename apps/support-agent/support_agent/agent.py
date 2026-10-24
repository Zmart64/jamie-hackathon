"""Run one user turn while retaining complete, valid Claude message history."""

from typing import Literal

from anthropic import (
    Anthropic,
    APIConnectionError,
    APIError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    RateLimitError,
)
from anthropic.types.beta import BetaMessage, BetaMessageParam
from pydantic import BaseModel, JsonValue, TypeAdapter, ValidationError

from support_agent.models import ChatMessage, ErrorDetail, ToolEvent, Turn
from support_agent.settings import AgentSettings
from support_agent.store import Session
from support_agent.tools import MockTools

JSON_VALUE = TypeAdapter[JsonValue](JsonValue)


class LocalToolResult(BaseModel):
    """Validate the narrower result format used by this service at the SDK boundary."""

    type: Literal["tool_result"]
    tool_use_id: str
    content: str
    is_error: bool = False


class AgentFailure(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def _decode_result(content: str) -> JsonValue:
    try:
        return JSON_VALUE.validate_json(content)
    except ValidationError:
        return content


def _record_tools(turn: Turn, message: BetaMessage, response: BetaMessageParam) -> None:
    calls = {block.id: block for block in message.content if block.type == "tool_use"}
    results = TypeAdapter(list[LocalToolResult]).validate_python(response["content"])
    for result in results:
        call = calls[result.tool_use_id]
        turn.tool_events.append(
            ToolEvent(
                turn_id=turn.turn_id,
                tool_call_id=call.id,
                name=call.name,
                arguments=JSON_VALUE.validate_python(call.input),
                result=_decode_result(result.content),
                is_error=result.is_error,
            )
        )


def _provider_error(error: APIError) -> ErrorDetail:
    if isinstance(error, AuthenticationError):
        return ErrorDetail(
            code="provider_authentication", message="Check the backend Claude API key."
        )
    if isinstance(error, RateLimitError):
        return ErrorDetail(
            code="provider_rate_limit", message="Claude is rate limited. Try again later."
        )
    if isinstance(error, (APITimeoutError, APIConnectionError)):
        return ErrorDetail(
            code="provider_unavailable", message="Could not reach Claude. Try again later."
        )
    if isinstance(error, BadRequestError):
        return ErrorDetail(
            code="provider_rejected_request",
            message="Claude rejected the request. Check model settings; if the conversation is "
            "too long, start a new session. History has not been truncated.",
        )
    return ErrorDetail(code="provider_error", message="Claude could not complete this turn.")


class SupportAgent:
    def __init__(self, settings: AgentSettings, prompt: str, client: Anthropic | None) -> None:
        self._settings = settings
        self._prompt = prompt
        self._client = client

    def respond(self, session: Session, text: str) -> Turn:
        """Caller holds the session lock; completed tool side effects survive a failed turn."""
        turn = Turn(session_id=session.id)
        user_message = ChatMessage(turn_id=turn.turn_id, role="user", content=text)
        turn.messages.append(user_message)
        session.messages.append(user_message)
        session.history.append({"role": "user", "content": text})
        try:
            turn.reply = self._run(session, turn)
            assistant_message = ChatMessage(
                turn_id=turn.turn_id, role="assistant", content=turn.reply
            )
            turn.messages.append(assistant_message)
            session.messages.append(assistant_message)
        except AgentFailure as error:
            turn.error = ErrorDetail(code=error.code, message=str(error))
        except APIError as error:
            turn.error = _provider_error(error)
        if turn.error is not None:
            turn.status = "failed"
        session.turns.append(turn)
        return turn

    def _run(self, session: Session, turn: Turn) -> str:
        if self._client is None:
            raise AgentFailure(
                "missing_api_key", "Set ANTHROPIC_API_KEY in the backend environment."
            )
        runner = self._client.beta.messages.tool_runner(
            model=session.model,
            max_tokens=self._settings.max_output_tokens,
            system=self._prompt,
            messages=session.history,
            tools=MockTools(session).registered(),
            max_iterations=self._settings.max_model_steps_per_turn,
        )
        for message in runner:
            if message.stop_reason == "tool_use":
                response = runner.generate_tool_call_response()
                if response is None:
                    raise AgentFailure("invalid_response", "Claude requested no executable tools.")
                # Mirror the SDK's cached results, without modifying the runner's own history.
                session.history.extend([message.to_param(), response])
                _record_tools(turn, message, response)
            elif message.stop_reason in ("end_turn", "refusal", "stop_sequence"):
                reply = "\n".join(block.text for block in message.content if block.type == "text")
                if not reply.strip():
                    raise AgentFailure("empty_response", "Claude returned no text reply.")
                session.history.append(message.to_param())
                return reply
            else:
                # Never execute tool calls from truncated or otherwise unfinished responses.
                raise AgentFailure(
                    "incomplete_response",
                    f"Claude stopped with {message.stop_reason}. Check token limits or start "
                    "a new session. Completed tool actions are retained.",
                )
        raise AgentFailure(
            "step_limit",
            "The turn reached its model-step limit. Completed tool actions are retained.",
        )
