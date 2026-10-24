import asyncio

from attacker_agent.models import RunView
from attacker_agent.replay import ReplayBundle
from attacker_agent.settings import Settings

from .helpers import ClaudeStub, ModelStub, api_client, decision, wait_for_run


def test_replay_contains_real_timing_notes_and_survives_restart(settings: Settings) -> None:
    async def exercise() -> None:
        model, claude = ModelStub(), ClaudeStub()
        model.add(decision())
        final = decision("finish", "")
        final["knowledge_updates"] = [
            {
                "key": "code-required",
                "kind": "observation",
                "statement": "The bot says it needs a code.",
                "evidence": [{"step_id": 1, "quote": "Need a code."}],
            }
        ]
        model.add(final)
        claude.reply("Need a code.")
        async with api_client(settings, model, claude) as api:
            run_id = (await api.post("/runs", json={})).json()["id"]
            view = await wait_for_run(api, run_id)
            response = await api.get(f"/runs/{run_id}/replay")
            bundle = ReplayBundle.model_validate(response.json())
            assert bundle.run == view
            assert bundle.frames[0].offset_ms == 0
            assert [frame.offset_ms for frame in bundle.frames] == sorted(
                frame.offset_ms for frame in bundle.frames
            )
            assert [frame.event.id for frame in bundle.frames] == list(
                range(1, len(bundle.frames) + 1)
            )
            types = [frame.event.type for frame in bundle.frames]
            assert "knowledge_updated" in types
            assert "step_completed" in types
            assert types[-1] == "run_finished"
            assert bundle.run.objective.status == "not_observed"
            assert bundle.library.entries
            assert (await api.get("/knowledge")).json()["entries"]
        async with api_client(settings, ModelStub(), ClaudeStub()) as restarted:
            restored = RunView.model_validate((await restarted.get(f"/runs/{run_id}")).json())
            assert restored == view
            replay = ReplayBundle.model_validate(
                (await restarted.get(f"/runs/{run_id}/replay")).json()
            )
            assert replay == bundle

    asyncio.run(exercise())
