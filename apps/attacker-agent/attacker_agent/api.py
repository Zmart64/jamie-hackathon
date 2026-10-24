"""Local run controls and replayable SSE; no frontend or support-code changes."""

import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import ValidationError

from attacker_agent.clients import ModelClient, TargetClient
from attacker_agent.events import RunRecord
from attacker_agent.knowledge import load_library
from attacker_agent.knowledge_models import KnowledgeLibrary
from attacker_agent.models import CreateRun, Health, RunView
from attacker_agent.replay import ReplayBundle, build_replay, load_record
from attacker_agent.runner import Runner
from attacker_agent.settings import Settings, load_settings


class RunService:
    """Own clients and background tasks independently of the HTTP route functions."""

    def __init__(
        self,
        settings: Settings,
        provider_http: httpx.AsyncClient | None,
        target_http: httpx.AsyncClient | None,
    ) -> None:
        self.settings = settings
        self.library = load_library()
        self.own_provider = provider_http is None
        self.own_target = target_http is None
        self.provider = provider_http or httpx.AsyncClient(timeout=settings.request_timeout_seconds)
        self.target = target_http or httpx.AsyncClient(timeout=settings.request_timeout_seconds)
        self.records: dict[str, RunRecord] = {}

    def get(self, run_id: str) -> RunRecord:
        record = self.records.get(run_id)
        if record is None:
            try:
                if str(UUID(run_id)) != run_id:
                    raise ValueError("Noncanonical run ID")
                record = load_record(self.settings.log_dir, run_id)
            except (ValueError, OSError, ValidationError) as error:
                raise HTTPException(status_code=404, detail="Run not found.") from error
            self.records[run_id] = record
        return record

    def start(self, request: CreateRun) -> RunView:
        if self.settings.api_key is None:
            raise HTTPException(status_code=503, detail="Configure ABLITERATION_API_KEY first.")
        view = RunView(model=self.settings.model, request=request)
        record = RunRecord(view=view, log_dir=self.settings.log_dir)
        self.records[view.id] = record
        runner = Runner(
            record,
            ModelClient(self.provider, self.settings),
            TargetClient(self.target, str(self.settings.target_base_url)),
            self.settings,
            library=self.library,
        )
        record.task = asyncio.create_task(runner.run())
        return view.model_copy(deep=True)

    async def stop(self, run_id: str) -> RunView:
        record = self.get(run_id)
        if record.task is not None and not record.task.done():
            record.task.cancel()
            await asyncio.gather(record.task, return_exceptions=True)
            if not record.terminal:
                record.finish("stopped", "cancelled")
        return record.view.model_copy(deep=True)

    async def close(self) -> None:
        tasks = [record.task for record in self.records.values() if record.task is not None]
        for task in tasks:
            if not task.done():
                task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        if self.own_provider:
            await self.provider.aclose()
        if self.own_target:
            await self.target.aclose()


def _cursor(after: int, last_event_id: str | None) -> int:
    try:
        previous = int(last_event_id or "0")
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Last-Event-ID must be an integer.") from error
    if previous < 0:
        raise HTTPException(status_code=422, detail="Event cursor must not be negative.")
    return max(after, previous)


def create_app(
    settings: Settings | None = None,
    provider_http: httpx.AsyncClient | None = None,
    target_http: httpx.AsyncClient | None = None,
) -> FastAPI:
    settings = settings or load_settings()
    service = RunService(settings, provider_http, target_http)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        yield
        await service.close()

    app = FastAPI(title="STRAIN Black-Box Attacker", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Last-Event-ID"],
    )

    @app.get("/health", operation_id="getAttackerHealth")
    async def health() -> Health:
        return Health(
            configured=settings.api_key is not None,
            model=settings.model,
            target_base_url=str(settings.target_base_url),
        )

    @app.post("/runs", status_code=202, operation_id="startAttackRun")
    async def start_run(request: CreateRun) -> RunView:
        return service.start(request)

    @app.get("/knowledge", operation_id="getAttackKnowledge")
    async def get_knowledge() -> KnowledgeLibrary:
        return service.library.model_copy(deep=True)

    @app.get("/runs", operation_id="listAttackRuns")
    async def list_runs() -> list[RunView]:
        return [record.view.model_copy(deep=True) for record in service.records.values()]

    @app.get("/runs/{run_id}", operation_id="getAttackRun")
    async def get_run(run_id: str) -> RunView:
        return service.get(run_id).view.model_copy(deep=True)

    @app.get("/runs/{run_id}/replay", operation_id="getAttackReplay")
    async def get_replay(run_id: str) -> ReplayBundle:
        return build_replay(service.get(run_id), service.library)

    @app.post("/runs/{run_id}/stop", operation_id="stopAttackRun")
    async def stop_run(run_id: str) -> RunView:
        return await service.stop(run_id)

    @app.get("/runs/{run_id}/events", operation_id="streamAttackEvents")
    async def stream_events(
        run_id: str,
        after: Annotated[int, Query(ge=0)] = 0,
        last_event_id: Annotated[str | None, Header()] = None,
    ) -> StreamingResponse:
        record = service.get(run_id)
        cursor = _cursor(after, last_event_id)
        return StreamingResponse(
            record.stream(cursor),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return app
