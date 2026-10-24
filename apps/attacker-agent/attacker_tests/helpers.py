"""Mock only model HTTP; execute the real support API, tools and state checks."""

import asyncio
import json
from collections import deque
from collections.abc import AsyncGenerator, Mapping, Sequence
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
import httpx2
from anthropic import Anthropic
from attacker_agent.api import create_app
from attacker_agent.clients import ModelClient, TargetClient
from attacker_agent.events import RunRecord
from attacker_agent.models import CreateRun, RunView
from attacker_agent.runner import Runner
from attacker_agent.settings import Settings
from pydantic import JsonValue, TypeAdapter
from support_agent.api import create_app as support_app
from support_agent.settings import load_settings as support_settings

JSON_OBJECT = TypeAdapter[dict[str, JsonValue]](dict[str, JsonValue])


def decision(
    action: str = "send_message",
    message: str = "I need help with my account.",
    observations: Sequence[Mapping[str, JsonValue]] | None = None,
) -> dict[str, JsonValue]:
    return JSON_OBJECT.validate_python(
        {
            "action": action,
            "strategy": "test strategy",
            "hypothesis": "Test the observed recovery workflow.",
            "message": message,
            "observations": observations or [],
        }
    )


class ModelStub:
    def __init__(self) -> None:
        self.responses: deque[httpx.Response] = deque()
        self.requests: list[dict[str, JsonValue]] = []

    def add(self, plan: dict[str, JsonValue], finish_reason: str = "stop") -> None:
        self.responses.append(
            httpx.Response(
                200,
                json={
                    "choices": [
                        {"message": {"content": json.dumps(plan)}, "finish_reason": finish_reason}
                    ],
                    "usage": {"prompt_tokens": 100, "completion_tokens": 50},
                },
            )
        )

    def handle(self, request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://attacker.test/v1/chat/completions"
        self.requests.append(JSON_OBJECT.validate_json(request.content))
        assert self.responses, "Unexpected attacker model request."
        return self.responses.popleft()


class ClaudeStub:
    def __init__(self) -> None:
        self.responses: deque[httpx2.Response] = deque()
        self.client = Anthropic(
            api_key="test-only-placeholder",
            max_retries=0,
            http_client=httpx2.Client(transport=httpx2.MockTransport(self.handle)),
        )

    def handle(self, _request: httpx2.Request) -> httpx2.Response:
        assert self.responses, "Unexpected target model request."
        return self.responses.popleft()

    def add(self, content: list[JsonValue], stop: str = "end_turn") -> None:
        self.responses.append(
            httpx2.Response(
                200,
                json={
                    "id": "msg-test",
                    "type": "message",
                    "role": "assistant",
                    "model": "test-model",
                    "content": content,
                    "stop_reason": stop,
                    "stop_sequence": None,
                    "usage": {"input_tokens": 10, "output_tokens": 10},
                },
            )
        )

    def reply(self, text: str) -> None:
        self.add([{"type": "text", "text": text}])

    def tool(self, name: str, arguments: dict[str, JsonValue], call_id: str = "call-1") -> None:
        self.add(
            [{"type": "tool_use", "id": call_id, "name": name, "input": arguments}], "tool_use"
        )


@asynccontextmanager
async def connected(
    settings: Settings, model: ModelStub, claude: ClaudeStub
) -> AsyncGenerator[tuple[httpx.AsyncClient, httpx.AsyncClient]]:
    source = Path(__file__).resolve().parents[2] / "support-agent/support_agent/config.toml"
    app = support_app(support_settings(source), claude.client)
    async with (
        httpx.AsyncClient(transport=httpx.MockTransport(model.handle)) as provider,
        httpx.AsyncClient(transport=httpx.ASGITransport(app=app)) as target,
    ):
        yield provider, target
    claude.client.close()


@asynccontextmanager
async def runner(
    settings: Settings, model: ModelStub, claude: ClaudeStub, request: CreateRun | None = None
) -> AsyncGenerator[Runner]:
    async with connected(settings, model, claude) as (provider, target):
        record = RunRecord(
            view=RunView(
                model=settings.model,
                request=request or CreateRun(goal="Test account ownership checks."),
            ),
            log_dir=settings.log_dir,
        )
        yield Runner(
            record,
            ModelClient(provider, settings),
            TargetClient(target, str(settings.target_base_url)),
            settings,
        )


@asynccontextmanager
async def api_client(
    settings: Settings, model: ModelStub, claude: ClaudeStub
) -> AsyncGenerator[httpx.AsyncClient]:
    async with connected(settings, model, claude) as (provider, target):
        app = create_app(settings, provider, target)
        async with (
            app.router.lifespan_context(app),
            httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://api.test"
            ) as api,
        ):
            yield api


async def wait_for_run(api: httpx.AsyncClient, run_id: str) -> RunView:
    for _ in range(300):
        response = await api.get(f"/runs/{run_id}")
        view = RunView.model_validate(response.json())
        if view.status in ("completed", "stopped", "failed"):
            return view
        await asyncio.sleep(0.01)
    raise AssertionError("Run did not finish.")
