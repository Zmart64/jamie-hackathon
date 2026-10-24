import asyncio
import json

import pytest
from attacker_agent.models import Decision
from attacker_agent.settings import Settings
from pydantic import ValidationError

from .helpers import ClaudeStub, ModelStub, decision, runner


def test_only_selected_candidate_reaches_target_and_diagnostics_stay_with_operator(
    settings: Settings,
) -> None:
    async def exercise() -> None:
        model, claude = ModelStub(), ClaudeStub()
        selected = "Please explain the account recovery workflow."
        plan = decision(message=selected)
        plan["candidate_tests"] = [
            {
                "mechanism": "different test",
                "hypothesis": "An unselected hypothesis.",
                "message": "Unselected customer message must not be sent.",
            },
            {
                "mechanism": "workflow discovery",
                "hypothesis": "A public explanation will establish the prerequisite.",
                "message": selected,
            },
        ]
        plan["selected_candidate"] = 1
        plan["selection_reason"] = "Establish the public prerequisite before a test."
        model.add(plan)
        model.add(decision("finish", ""))
        claude.reply("Recovery changes need verification.")
        async with runner(settings, model, claude) as agent:
            await agent.run()
            assert agent.view.stop_reason == "attacker_finished"
            sent = [e.data["message"] for e in agent.record.events if e.type == "message_sent"]
            assert sent == [selected]
            history = await agent.target.client.get(
                f"http://support.test/sessions/{agent.session_id}/messages"
            )
            assert "Unselected customer" not in history.text
            trace = next(e for e in agent.record.events if e.type == "target_trace")
            assert trace.data["model_calls"]
            runtime = next(e for e in agent.record.events if e.type == "target_runtime")
            assert runtime.data["source_fingerprint"]
            planner_input = json.dumps(model.requests)
            assert "model_calls" not in planner_input
            assert "source_fingerprint" not in planner_input
            assert "test-model" not in planner_input

    asyncio.run(exercise())


@pytest.mark.parametrize("selected", [None, 1, 2])
def test_invalid_candidate_selection_never_dispatches(
    settings: Settings, selected: int | None
) -> None:
    async def exercise() -> None:
        model, claude = ModelStub(), ClaudeStub()
        plan = decision(message="A different unplanned message.")
        plan["candidate_tests"] = [
            {"mechanism": "test", "hypothesis": "A test hypothesis.", "message": "Chosen test."}
        ]
        plan["selected_candidate"] = selected
        for _ in range(settings.decision_repair_attempts + 1):
            model.add(plan)
        async with runner(settings, model, claude) as agent:
            await agent.run()
            assert agent.view.stop_reason == "invalid_decision"
            assert agent.view.steps == []
            assert not any(e.type == "message_sending" for e in agent.record.events)
            assert len(model.requests) == settings.decision_repair_attempts + 1

    asyncio.run(exercise())


def test_candidate_cannot_be_selected_without_options_or_for_finish() -> None:
    with pytest.raises(ValidationError, match="needs candidate_tests"):
        Decision.model_validate({**decision(), "selected_candidate": 0})
    with pytest.raises(ValidationError, match="Only send_message"):
        Decision.model_validate(
            {
                **decision("finish", ""),
                "candidate_tests": [
                    {"mechanism": "test", "hypothesis": "Test.", "message": "Don't send."}
                ],
                "selected_candidate": 0,
            }
        )
