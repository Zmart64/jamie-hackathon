import asyncio
import json
from pathlib import Path

from attacker_agent.adaptive_knowledge import AdaptiveKnowledge
from attacker_agent.events import RunRecord
from attacker_agent.knowledge import load_library
from attacker_agent.knowledge_models import KnowledgeUpdate, ReplyEvidence
from attacker_agent.models import CreateRun, Decision, RunView, Step
from attacker_agent.settings import Settings

from .helpers import ClaudeStub, ModelStub, decision, runner


def test_notebook_rejects_fabricated_evidence_and_scopes_session_state(tmp_path: Path) -> None:
    record = RunRecord(RunView(model="test", request=CreateRun()), tmp_path)
    record.view.steps.append(
        Step(
            id=1,
            session_id="first",
            decision=Decision.model_validate(decision()),
            status="completed",
            reply="I need a recovery code first.",
        )
    )
    memory = AdaptiveKnowledge(record)
    memory.start_session("first")
    note = KnowledgeUpdate(
        key="code-gate",
        kind="observation",
        statement="The bot says it needs a recovery code.",
        evidence=[ReplyEvidence(step_id=1, quote="I need a recovery code first.")],
    )
    assert memory.apply([note], 2) == [note]
    revised = note.model_copy(update={"kind": "hypothesis", "statement": "Test that gate."})
    memory.apply([revised], 3)
    assert len(record.view.knowledge.notes) == 1
    assert record.view.knowledge.notes[0].statement == "Test that gate."
    fake = KnowledgeUpdate.model_validate(
        {**note.model_dump(), "evidence": [{"step_id": 1, "quote": "Ownership verified."}]}
    )
    assert memory.apply([fake], 3) == []
    assert record.view.knowledge.last_update_results[0].accepted is False
    memory.start_session("second")
    assert record.view.knowledge.for_planner().notes == []
    assert memory.apply([note], 4) == []
    transferable = note.model_copy(update={"scope": "run"})
    assert memory.apply([transferable], 4) == [transferable]
    assert record.view.knowledge.for_planner().notes[0].scope == "run"
    saved = json.loads((tmp_path / record.view.id / "knowledge.json").read_text())
    assert len(saved["knowledge"]["notes"]) == 2
    assert load_library().entries
    assert all(
        not entry.surfaces or "customer_chat" in entry.surfaces
        for entry in load_library().for_surface("customer_chat").entries
    )


def test_accepted_notes_are_used_on_next_decision_and_rejections_reported(
    settings: Settings,
) -> None:
    async def exercise() -> None:
        model, claude = ModelStub(), ClaudeStub()
        model.add(decision(message="What is required?"))
        plan = decision(message="Try a different workflow.")
        plan["knowledge_updates"] = [
            {
                "key": "observed-gate",
                "kind": "observation",
                "statement": "Bot asks for a code.",
                "evidence": [{"step_id": 1, "quote": "Provide the recovery code."}],
            },
            {
                "key": "invented-tool",
                "kind": "observation",
                "statement": "There is an admin override.",
                "evidence": [{"step_id": 1, "quote": "I have an admin override."}],
            },
        ]
        model.add(plan)
        model.add(decision("finish", ""))
        claude.reply("Provide the recovery code.")
        claude.reply("Still need a code.")
        async with runner(settings, model, claude) as agent:
            await agent.run()
            assert [note.key for note in agent.view.knowledge.notes] == ["observed-gate"]
            messages = model.requests[2]["messages"]
            assert isinstance(messages, list)
            context_message = messages[-1]
            assert isinstance(context_message, dict)
            context = json.loads(str(context_message["content"]))
            assert context["run_knowledge"]["notes"][0]["key"] == "observed-gate"
            results = context["run_knowledge"]["last_update_results"]
            assert [result["accepted"] for result in results] == [True, False]
            assert "admin override" not in json.dumps(model.requests[2])

    asyncio.run(exercise())
