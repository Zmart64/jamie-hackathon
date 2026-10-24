import asyncio
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import cast
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from attacker_agent.browser_demo import BrowserOptions, run_browser
from attacker_agent.browser_display import follow_browser, panel_html
from attacker_agent.browser_target import BrowserTarget, message_session
from attacker_agent.clients import RunFailure, TargetClient, TargetTurn, ToolReceipt
from attacker_agent.events import RunRecord
from attacker_agent.models import CreateRun, Decision, RunView, Step
from attacker_agent.settings import Settings
from playwright.async_api import Locator, Page, Request, Response, Route

from .helpers import ClaudeStub, ModelStub, connected, decision, runner


def _record(path: Path) -> RunRecord:
    return RunRecord(RunView(model="test", request=CreateRun()), path)


def test_browser_observer_captures_pre_turn_state_without_replacing_requests(
    settings: Settings,
) -> None:
    async def exercise() -> None:
        async with connected(settings, ModelStub(), ClaudeStub()) as (_, client):
            real = await TargetClient(client, str(settings.target_base_url)).new_session(None)
            page = MagicMock(spec=Page)
            target = BrowserTarget(
                cast(Page, page),
                client,
                str(settings.target_base_url),
                "http://127.0.0.1:5174",
                _record(settings.log_dir),
            )
            target.active_handle = "logical-conversation"
            request = MagicMock(spec=Request)
            request.method = "POST"
            request.url = f"http://127.0.0.1:5174/api/support/sessions/{real}/messages"
            route = MagicMock(spec=Route)
            route.request = request
            route.continue_ = AsyncMock()
            await target.install()
            callback = cast(Callable[[Route], Awaitable[None]], page.route.call_args.args[1])
            await callback(cast(Route, route))
            assert target.bindings["logical-conversation"] == real
            assert target.before_send_state is not None
            assert target.before_send_state.outbox == []
            assert await target.inspect("logical-conversation") == target.before_send_state
            route.continue_.assert_awaited_once_with()
            route.fulfill.assert_not_called()
            assert message_session(request.url + "?tracking=1") == real
            assert message_session("http://localhost/api/support/sessions") is None

    asyncio.run(exercise())


def test_composer_constraints_are_returned_to_planner_without_dispatch(settings: Settings) -> None:
    async def exercise() -> None:
        model, claude = ModelStub(), ClaudeStub()
        model.add(decision(message="line one\nline two"))
        model.add(decision(message="A message that is too long"))
        model.add(decision(message="Valid"))
        model.add(decision("finish", ""))
        claude.reply("Received the valid message.")
        async with runner(settings, model, claude) as agent:
            agent.target.single_line_messages = True
            agent.target.max_message_chars = 20
            await agent.run()
            assert [step.status for step in agent.view.steps] == [
                "skipped",
                "skipped",
                "completed",
                "completed",
            ]
            sent = [
                event.data["message"]
                for event in agent.record.events
                if event.type == "message_sent"
            ]
            assert sent == ["Valid"]
            feedback = [
                event.data["reason"]
                for event in agent.record.events
                if event.type == "decision_rejected"
            ]
            assert "one line" in str(feedback[0])
            assert "20 characters" in str(feedback[1])

    asyncio.run(exercise())


def test_failed_dom_delivery_retains_real_tool_receipts(
    settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def exercise() -> None:
        expected = MagicMock()
        expected.to_have_text = AsyncMock(side_effect=AssertionError("Not rendered"))
        expected.to_be_editable = AsyncMock()
        monkeypatch.setattr(
            "attacker_agent.browser_target.expect", MagicMock(return_value=expected)
        )
        async with connected(settings, ModelStub(), ClaudeStub()) as (_, client):
            page = MagicMock(spec=Page)
            composer = MagicMock(spec=Locator)
            composer.input_value.return_value = "test"
            page.get_by_role.return_value = composer
            target = BrowserTarget(
                cast(Page, page),
                client,
                str(settings.target_base_url),
                "http://127.0.0.1:5174",
                _record(settings.log_dir),
            )
            receipt = ToolReceipt(name="send_password_reset", result={"sent": True})
            turn = TargetTurn(
                turn_id="turn", status="completed", reply="Sent.", tool_events=[receipt]
            )
            response = MagicMock(spec=Response)
            response.json.return_value = turn.model_dump(mode="json")
            future: asyncio.Future[Response] = asyncio.get_running_loop().create_future()
            future.set_result(cast(Response, response))
            pending = MagicMock()
            pending.value = future
            page.expect_response.return_value.__aenter__.return_value = pending
            target.active_handle = "active"
            observed = await target.send("active", "test")
            assert observed.status == "failed" and observed.reply is None
            assert observed.tool_events == [receipt]
            with pytest.raises(RunFailure, match="not active"):
                await target.send("wrong", "test")
            with pytest.raises(RunFailure, match="2000-character"):
                await target.send("active", "x" * 2001)

    asyncio.run(exercise())


def test_panel_escapes_model_text_and_flushes_terminal_state(tmp_path: Path) -> None:
    async def exercise() -> None:
        record = _record(tmp_path)
        plan = Decision.model_validate(decision())
        plan.hypothesis = "<img src=x onerror=alert(1)>"
        record.view.steps.append(Step(id=1, session_id="session", decision=plan))
        record.view.sessions.append("session")
        record.emit("planning")
        rendered: list[str] = []

        async def evaluate(_script: str, html: str) -> None:
            rendered.append(html)
            if len(rendered) == 1:
                record.finish("completed", "step_limit")

        page = MagicMock(spec=Page)
        page.evaluate = AsyncMock(side_effect=evaluate)
        await follow_browser(record, cast(Page, page))
        assert len(rendered) == 2
        assert "run finished" in rendered[-1]
        assert "completed" in rendered[-1]
        html = panel_html(record, "<script>unsafe</script>")
        assert "<img" not in html and "<script>" not in html
        assert "&lt;img" in html and "&lt;script&gt;" in html

    asyncio.run(exercise())


@pytest.mark.parametrize("show_overlay", [False, True])
@pytest.mark.parametrize("headless", [False, True])
def test_recording_keeps_notebook_off_target_unless_requested(
    settings: Settings, monkeypatch: pytest.MonkeyPatch, show_overlay: bool, headless: bool
) -> None:
    async def exercise() -> None:
        record = _record(settings.log_dir)
        page = MagicMock(spec=Page)
        page.video = None
        context = MagicMock()
        context.new_page = AsyncMock(return_value=page)
        context.tracing.start = AsyncMock()
        context.tracing.stop = AsyncMock()
        context.close = AsyncMock()
        browser = MagicMock()
        browser.new_context = AsyncMock(return_value=context)
        browser.close = AsyncMock()
        playwright = MagicMock()
        playwright.chromium.launch = AsyncMock(return_value=browser)
        manager = MagicMock()
        manager.__aenter__ = AsyncMock(return_value=playwright)
        manager.__aexit__ = AsyncMock(return_value=None)
        monkeypatch.setattr(
            "attacker_agent.browser_demo.async_playwright", MagicMock(return_value=manager)
        )
        agent = MagicMock()
        agent.run = AsyncMock(side_effect=lambda: record.finish("completed", "attacker_finished"))
        monkeypatch.setattr("attacker_agent.browser_demo.Runner", MagicMock(return_value=agent))
        pause = AsyncMock()
        monkeypatch.setattr("attacker_agent.browser_demo.asyncio.sleep", pause)
        options = BrowserOptions(headless=headless, hold_seconds=3)
        if show_overlay:
            options = options.model_copy(update={"show_notebook_overlay": True})
        async with httpx.AsyncClient() as client:
            await run_browser(record, client, settings, options)
        if show_overlay:
            page.evaluate.assert_awaited_once()
        else:
            page.evaluate.assert_not_awaited()
        page.screenshot.assert_awaited_once()
        # A successful final reply must remain visible in headless recordings too.
        pause.assert_awaited_once_with(3)
        capture = browser.new_context.call_args.kwargs
        assert capture["viewport"] == capture["record_video_size"]
        assert (settings.log_dir / record.view.id / "browser.json").exists()

    asyncio.run(exercise())
