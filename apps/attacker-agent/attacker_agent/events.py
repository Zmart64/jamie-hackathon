"""Append-only run events with replay for a thin live UI."""

import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, JsonValue, TypeAdapter

from attacker_agent.models import RunEvent, RunView

JSON_OBJECT = TypeAdapter[dict[str, JsonValue]](dict[str, JsonValue])


def as_data(model: BaseModel) -> dict[str, JsonValue]:
    return JSON_OBJECT.validate_json(model.model_dump_json())


@dataclass
class RunRecord:
    view: RunView
    log_dir: Path
    events: list[RunEvent] = field(default_factory=list[RunEvent])
    changed: asyncio.Event = field(default_factory=asyncio.Event)
    task: asyncio.Task[None] | None = None

    @property
    def terminal(self) -> bool:
        return self.view.status in ("completed", "stopped", "failed")

    def emit(
        self,
        kind: str,
        data: dict[str, JsonValue] | None = None,
        step_id: int | None = None,
        visibility: Literal["public", "operator"] = "operator",
    ) -> None:
        event = RunEvent(
            id=len(self.events) + 1,
            run_id=self.view.id,
            type=kind,
            step_id=step_id,
            visibility=visibility,
            data=data or {},
        )
        self.log_dir.mkdir(parents=True, exist_ok=True)
        with (self.log_dir / f"{self.view.id}.jsonl").open("a", encoding="utf-8") as handle:
            handle.write(event.model_dump_json() + "\n")
        self.events.append(event)
        self.changed.set()

    def finish(self, status: Literal["completed", "stopped", "failed"], reason: str) -> None:
        self.view.status = status
        self.view.stop_reason = reason
        self.emit("run_finished", {"status": status, "reason": reason})

    async def stream(self, after: int) -> AsyncIterator[str]:
        cursor = after
        while True:
            self.changed.clear()
            for event in self.events:
                if event.id > cursor:
                    yield f"id: {event.id}\nevent: {event.type}\ndata: {event.model_dump_json()}\n\n"
                    cursor = event.id
            if self.terminal:
                return
            try:
                await asyncio.wait_for(self.changed.wait(), timeout=10)
            except TimeoutError:
                yield ": heartbeat\n\n"
