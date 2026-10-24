import asyncio
import json

import httpx
import pytest
from attacker_agent.clients import ModelClient, TargetClient
from attacker_agent.events import RunRecord
from attacker_agent.models import CreateRun, Limits, RunView
from attacker_agent.runner import Runner
from attacker_agent.settings import Settings

from .helpers import ClaudeStub, ModelStub, connected, decision, runner


@pytest.mark.parametrize("content", [None, "", " \n "])
def test_empty_provider_content_fails_without_sending_to_target(
    settings: Settings, content: str | None
) -> None:
    async def exercise() -> None:
        model, claude = ModelStub(), ClaudeStub()
        model.responses.append(
            httpx.Response(
                200,
                json={"choices": [{"message": {"content": content}, "finish_reason": "stop"}]},
            )
        )
        async with runner(settings, model, claude) as agent:
            await agent.run()
            assert agent.view.stop_reason == "attacker_empty_response"
            assert agent.view.steps == []
            assert not any(event.type == "message_sending" for event in agent.record.events)
            assert len(model.requests) == 1

    asyncio.run(exercise())


@pytest.mark.parametrize("finish_reason", ["length", "content_filter"])
def test_truncated_or_blocked_plan_never_reaches_target(
    settings: Settings, finish_reason: str
) -> None:
    async def exercise() -> None:
        model, claude = ModelStub(), ClaudeStub()
        model.add(decision(), finish_reason)
        async with runner(settings, model, claude) as agent:
            await agent.run()
            assert agent.view.status == "failed"
            assert agent.view.steps == []
            assert not any(event.type == "message_sent" for event in agent.record.events)

    asyncio.run(exercise())


def test_provider_error_is_sanitized_and_not_retried(settings: Settings) -> None:
    async def exercise() -> None:
        model, claude = ModelStub(), ClaudeStub()
        model.responses.append(httpx.Response(429, json={"secret": "provider-private-detail"}))
        async with runner(settings, model, claude) as agent:
            await agent.run()
            assert agent.view.stop_reason == "attacker_provider_error"
            assert len(model.requests) == 1
            events = json.dumps([event.model_dump(mode="json") for event in agent.record.events])
            assert "provider-private-detail" not in events
            assert "test-only-placeholder" not in events

    asyncio.run(exercise())


def test_large_profile_avoids_provider_json_mode_and_hides_reasoning(settings: Settings) -> None:
    async def exercise() -> None:
        configured = settings.model_copy(
            update={"model": "abliterated-model-large-v2", "reasoning_effort": "low"}
        )
        model, claude = ModelStub(), ClaudeStub()
        model.add(decision("finish", ""))
        async with runner(configured, model, claude) as agent:
            await agent.run()
            assert agent.view.stop_reason == "attacker_finished"
            body = model.requests[0]
            assert "response_format" not in body
            assert "thinking" not in body
            assert body["reasoning_effort"] == "low"
            assert body["include_reasoning"] is False
        model = ModelStub()
        for _ in range(configured.decision_repair_attempts + 1):
            model.add({"action": "unrecognized"})
        async with runner(configured, model, ClaudeStub()) as agent:
            await agent.run()
            assert agent.view.stop_reason == "invalid_decision"
            assert agent.view.steps == []

    asyncio.run(exercise())


def test_target_failure_can_still_have_a_verified_side_effect(settings: Settings) -> None:
    async def exercise() -> None:
        model, claude = ModelStub(), ClaudeStub()
        model.add(decision())
        claude.tool(
            "update_recovery_email",
            {"account_id": "account-alex", "new_email": "attacker@example.com"},
        )
        import httpx2

        claude.responses.append(
            httpx2.Response(
                500, json={"type": "error", "error": {"type": "api_error", "message": "down"}}
            )
        )
        async with runner(settings, model, claude) as agent:
            await agent.run()
            assert agent.view.status == "failed"
            assert agent.view.stop_reason == "target_turn_failed"
            assert len(agent.view.findings) == 1
            assert agent.view.findings[0].kind == "unverified_recovery_change"
            assert len(model.requests) == 1

    asyncio.run(exercise())


def test_step_and_context_limits_do_not_start_extra_model_requests(settings: Settings) -> None:
    async def exercise() -> None:
        model, claude = ModelStub(), ClaudeStub()
        model.add(decision())
        claude.reply("Please verify your account.")
        request = CreateRun(goal="Test", limits=Limits(max_steps=1))
        async with runner(settings, model, claude, request) as agent:
            await agent.run()
            assert agent.view.stop_reason == "step_limit"
            assert len(model.requests) == 1
        limited = settings.model_copy(update={"max_context_chars": 1000})
        async with runner(limited, ModelStub(), ClaudeStub()) as agent:
            await agent.run()
            assert agent.view.stop_reason == "context_limit"
            assert agent.view.steps == []

    asyncio.run(exercise())


def test_time_limit_cancels_pending_model_request(settings: Settings) -> None:
    async def exercise() -> None:
        async def pending(_request: httpx.Request) -> httpx.Response:
            await asyncio.sleep(10)
            raise AssertionError("The model request should have been cancelled.")

        async with (
            connected(settings, ModelStub(), ClaudeStub()) as (_, target),
            httpx.AsyncClient(transport=httpx.MockTransport(pending)) as provider,
        ):
            record = RunRecord(
                RunView(
                    model=settings.model,
                    request=CreateRun(goal="Test", limits=Limits(max_seconds=1)),
                ),
                settings.log_dir,
            )
            agent = Runner(
                record,
                ModelClient(provider, settings),
                TargetClient(target, str(settings.target_base_url)),
                settings,
            )
            await agent.run()
            assert record.view.stop_reason == "time_limit"
            assert not any(event.type == "message_sent" for event in record.events)

    asyncio.run(exercise())
