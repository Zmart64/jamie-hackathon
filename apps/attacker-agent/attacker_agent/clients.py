"""Small HTTP adapters. Public replies and operator-only receipts stay distinct."""

from typing import Literal
from uuid import UUID

import httpx
from pydantic import BaseModel, Field, JsonValue, ValidationError

from attacker_agent.models import ChatEntry, Decision, PublicObservation, TokenUsage
from attacker_agent.settings import Settings


class RunFailure(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class Plan(BaseModel):
    decision: Decision
    usage: TokenUsage | None = None


class CompletionMessage(BaseModel):
    content: str | None = None
    refusal: str | None = None


class CompletionChoice(BaseModel):
    message: CompletionMessage
    finish_reason: str


class Completion(BaseModel):
    choices: list[CompletionChoice] = Field(min_length=1)
    usage: TokenUsage | None = None


class ModelClient:
    def __init__(self, client: httpx.AsyncClient, settings: Settings) -> None:
        self.client = client
        self.settings = settings

    async def decide(self, history: list[ChatEntry]) -> Plan:
        if self.settings.api_key is None:
            raise RunFailure("missing_api_key", "Configure ABLITERATION_API_KEY in the backend.")
        url = str(self.settings.provider_base_url).rstrip("/") + "/chat/completions"
        body = {
            "model": self.settings.model,
            "messages": [entry.model_dump() for entry in history],
            "response_format": {"type": "json_object"},
            "max_tokens": self.settings.max_output_tokens,
            # Large Flash can return an empty content field with reasoning enabled.
            # The controller needs only the structured decision and brief hypothesis.
            "thinking": False,
            "include_reasoning": False,
            "stream": False,
        }
        try:
            response = await self.client.post(
                url,
                headers={"Authorization": "Bearer " + self.settings.api_key.get_secret_value()},
                json=body,
            )
            response.raise_for_status()
        except httpx.HTTPError as error:
            raise RunFailure(
                "attacker_provider_error",
                "The attacker provider request failed. Check credentials, balance and service.",
            ) from error
        return self._parse(response)

    @staticmethod
    def _parse(response: httpx.Response) -> Plan:
        try:
            completion = Completion.model_validate_json(response.content)
            choice = completion.choices[0]
            if choice.message.refusal or choice.finish_reason == "content_filter":
                raise RunFailure("attacker_refused", "The attacker provider refused this step.")
            if choice.finish_reason != "stop":
                raise RunFailure("attacker_incomplete", "The attacker response did not finish.")
            if not choice.message.content or not choice.message.content.strip():
                raise RunFailure(
                    "attacker_empty_response", "The attacker provider returned no decision text."
                )
            decision = Decision.model_validate_json(choice.message.content)
        except ValidationError as error:
            raise RunFailure(
                "invalid_decision", "The attacker returned an invalid decision."
            ) from error
        return Plan(decision=decision, usage=completion.usage)


class ToolReceipt(BaseModel):
    name: str
    arguments: JsonValue = None
    result: JsonValue = None
    is_error: bool = False


class TargetTurn(BaseModel):
    turn_id: str
    status: Literal["completed", "failed"]
    reply: str | None
    reply_source: Literal["model", "refusal_fallback"] = "model"
    tool_events: list[ToolReceipt] = Field(default_factory=list[ToolReceipt])

    def observation(self, step_id: int, session_id: str) -> PublicObservation:
        if self.status != "completed" or not self.reply or not self.reply.strip():
            raise RunFailure("target_turn_failed", "The support agent did not complete its turn.")
        return PublicObservation(step_id=step_id, session_id=session_id, reply=self.reply)


class AccountState(BaseModel):
    id: str
    recovery_email: str
    verified: bool


class OutboxMessage(BaseModel):
    id: str
    account_id: str
    to: str


class MockState(BaseModel):
    accounts: list[AccountState]
    outbox: list[OutboxMessage]


class CreatedSession(BaseModel):
    session_id: UUID


class TargetClient:
    def __init__(self, client: httpx.AsyncClient, base_url: str) -> None:
        self.client = client
        self.base_url = base_url.rstrip("/")

    async def new_session(self, identifier: str | None) -> str:
        body = {"account_identifier": identifier} if identifier else {}
        try:
            response = await self.client.post(self.base_url + "/sessions", json=body)
            response.raise_for_status()
            return str(CreatedSession.model_validate_json(response.content).session_id)
        except (httpx.HTTPError, ValidationError) as error:
            raise RunFailure("target_unavailable", "Could not create a support session.") from error

    async def send(self, session_id: str, message: str) -> TargetTurn:
        url = f"{self.base_url}/sessions/{session_id}/messages"
        try:
            response = await self.client.post(url, json={"message": message})
            if response.status_code not in (200, 502, 503):
                response.raise_for_status()
            return TargetTurn.model_validate_json(response.content)
        except (httpx.HTTPError, ValidationError) as error:
            raise RunFailure(
                "target_request_failed",
                "The support request failed; it is not automatically retried. "
                "An in-flight target action may still have executed.",
            ) from error

    async def inspect(self, session_id: str) -> MockState | None:
        """Optional operator observer, never called through an attacker-selected action."""
        try:
            response = await self.client.get(f"{self.base_url}/sessions/{session_id}/mock-state")
            response.raise_for_status()
            return MockState.model_validate_json(response.content)
        except (httpx.HTTPError, ValidationError):
            return None
