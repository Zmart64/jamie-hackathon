"""Script Claude's HTTP responses while exercising the real SDK and tool runner."""

from collections import deque

import httpx2
from anthropic import Anthropic
from fastapi.testclient import TestClient
from pydantic import JsonValue, TypeAdapter
from support_agent.models import SessionInfo

JSON_OBJECT = TypeAdapter[dict[str, JsonValue]](dict[str, JsonValue])


def start_session(api: TestClient) -> str:
    response = api.post("/sessions")
    assert response.status_code == 201
    return SessionInfo.model_validate(response.json()).session_id


def tool_call(name: str, arguments: dict[str, JsonValue], call_id: str = "call-1") -> JsonValue:
    return {"type": "tool_use", "id": call_id, "name": name, "input": arguments}


def claude_message(content: list[JsonValue], stop_reason: str = "end_turn") -> httpx2.Response:
    return httpx2.Response(
        200,
        json={
            "id": "msg-test",
            "type": "message",
            "role": "assistant",
            "model": "test-model",
            "content": content,
            "stop_reason": stop_reason,
            "stop_sequence": None,
            "usage": {"input_tokens": 10, "output_tokens": 10},
        },
    )


def reply(text: str) -> httpx2.Response:
    return claude_message([{"type": "text", "text": text}])


class ClaudeStub:
    def __init__(self) -> None:
        self.responses: deque[httpx2.Response | Exception] = deque()
        self.requests: list[dict[str, JsonValue]] = []
        self.client = Anthropic(
            api_key="test-only-placeholder",
            max_retries=0,
            http_client=httpx2.Client(transport=httpx2.MockTransport(self._handle)),
        )

    def _handle(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(JSON_OBJECT.validate_json(request.content))
        if not self.responses:
            raise AssertionError("Unexpected Claude API request.")
        response = self.responses.popleft()
        if isinstance(response, Exception):
            raise response
        return response

    def add_tool(self, name: str, arguments: dict[str, JsonValue], call_id: str) -> None:
        self.responses.append(claude_message([tool_call(name, arguments, call_id)], "tool_use"))
