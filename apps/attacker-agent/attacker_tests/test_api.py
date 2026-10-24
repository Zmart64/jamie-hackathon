import asyncio
import json

import httpx
from attacker_agent.api import create_app
from attacker_agent.models import RunEvent, RunView
from attacker_agent.settings import Settings

from .helpers import ClaudeStub, ModelStub, api_client, connected, decision, wait_for_run


def test_run_api_replays_events_with_resume_cursors(settings: Settings) -> None:
    async def exercise() -> None:
        model, claude = ModelStub(), ClaudeStub()
        model.add(decision())
        model.add(decision("finish", ""))
        claude.reply("I can help with account recovery.")
        async with api_client(settings, model, claude) as api:
            response = await api.post("/runs", json={"goal": "Test ownership checks."})
            assert response.status_code == 202
            initial = RunView.model_validate(response.json())
            view = await wait_for_run(api, initial.id)
            assert view.status == "completed" and len(view.steps) == 2
            stream = await api.get(f"/runs/{view.id}/events")
            assert stream.headers["content-type"].startswith("text/event-stream")
            events = [
                RunEvent.model_validate_json(line[6:])
                for line in stream.text.split("\n")
                if line.startswith("data: ")
            ]
            assert [event.id for event in events] == list(range(1, len(events) + 1))
            assert events[-1].type == "run_finished"
            assert any(event.type == "step_planned" for event in events)
            assert any(event.type == "target_reply" for event in events)
            cursor = events[len(events) // 2].id
            resumed = await api.get(
                f"/runs/{view.id}/events", headers={"Last-Event-ID": str(cursor)}
            )
            replay = [
                RunEvent.model_validate_json(line[6:])
                for line in resumed.text.split("\n")
                if line.startswith("data: ")
            ]
            assert [event.id for event in replay] == [
                event.id for event in events if event.id > cursor
            ]
            logged = (settings.log_dir / f"{view.id}.jsonl").read_text().splitlines()
            assert [RunEvent.model_validate_json(line) for line in logged] == events
            schema = (await api.get("/openapi.json")).json()
            assert schema["paths"]["/runs"]["post"]["operationId"] == "startAttackRun"

    asyncio.run(exercise())


def test_missing_key_invalid_requests_and_unknown_runs(settings: Settings) -> None:
    async def exercise() -> None:
        missing = settings.model_copy(update={"api_key": None})
        async with api_client(missing, ModelStub(), ClaudeStub()) as api:
            health = await api.get("/health")
            assert health.json()["configured"] is False
            assert "api_key" not in health.text
            assert (await api.get("/docs")).status_code == 200
            assert (await api.post("/runs", json={"goal": "Test"})).status_code == 503
            assert (await api.post("/runs", json={"goal": ""})).status_code == 422
            assert (await api.get("/runs/missing")).status_code == 404
            assert (await api.post("/runs/missing/stop")).status_code == 404
            assert (await api.get("/runs/missing/events")).status_code == 404

    asyncio.run(exercise())


def test_two_runs_keep_separate_target_sessions(settings: Settings) -> None:
    async def exercise() -> None:
        model, claude = ModelStub(), ClaudeStub()
        model.add(decision("finish", ""))
        model.add(decision("finish", ""))
        async with api_client(settings, model, claude) as api:
            first = RunView.model_validate((await api.post("/runs", json={"goal": "First"})).json())
            second = RunView.model_validate(
                (await api.post("/runs", json={"goal": "Second"})).json()
            )
            one, two = await wait_for_run(api, first.id), await wait_for_run(api, second.id)
            assert one.id != two.id and one.sessions[0] != two.sessions[0]
            assert len((await api.get("/runs")).json()) == 2
            assert one.sessions[0] not in json.dumps(two.model_dump(mode="json"))

    asyncio.run(exercise())


def test_stop_interrupts_pending_request_and_is_idempotent(settings: Settings) -> None:
    async def exercise() -> None:
        started = asyncio.Event()

        async def pending(_request: httpx.Request) -> httpx.Response:
            started.set()
            await asyncio.sleep(10)
            raise AssertionError("The model request should have been cancelled.")

        async with (
            connected(settings, ModelStub(), ClaudeStub()) as (_, target),
            httpx.AsyncClient(transport=httpx.MockTransport(pending)) as provider,
        ):
            app = create_app(settings, provider, target)
            async with (
                app.router.lifespan_context(app),
                httpx.AsyncClient(
                    transport=httpx.ASGITransport(app=app), base_url="http://api.test"
                ) as api,
            ):
                response = await api.post("/runs", json={"goal": "Test"})
                run_id = response.json()["id"]
                await asyncio.wait_for(started.wait(), timeout=2)
                stopped = await api.post(f"/runs/{run_id}/stop")
                view = RunView.model_validate(stopped.json())
                assert view.status == "stopped" and view.stop_reason == "cancelled"
                assert (await api.post(f"/runs/{run_id}/stop")).json() == stopped.json()
                assert view.steps == []

    asyncio.run(exercise())


def test_event_cursors_and_cors(settings: Settings) -> None:
    async def exercise() -> None:
        model, claude = ModelStub(), ClaudeStub()
        model.add(decision("finish", ""))
        async with api_client(settings, model, claude) as api:
            run_id = (await api.post("/runs", json={"goal": "Test"})).json()["id"]
            await wait_for_run(api, run_id)
            bad = await api.get(f"/runs/{run_id}/events", headers={"Last-Event-ID": "invalid"})
            assert bad.status_code == 422
            negative = await api.get(f"/runs/{run_id}/events", headers={"Last-Event-ID": "-1"})
            assert negative.status_code == 422
            assert (await api.get(f"/runs/{run_id}/events?after=-1")).status_code == 422
            allowed = await api.options(
                "/runs",
                headers={
                    "Origin": "http://localhost:5173",
                    "Access-Control-Request-Method": "POST",
                },
            )
            assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"

    asyncio.run(exercise())
