"""Portable, timed evidence for the separately developed demo frontend."""

from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from attacker_agent.events import RunRecord
from attacker_agent.knowledge_models import KnowledgeLibrary
from attacker_agent.models import RunEvent, RunView


class ReplayFrame(BaseModel):
    offset_ms: int
    event: RunEvent


class ReplayBundle(BaseModel):
    schema_version: Literal[1] = 1
    run: RunView
    library: KnowledgeLibrary
    frames: list[ReplayFrame]


def build_replay(record: RunRecord, library: KnowledgeLibrary) -> ReplayBundle:
    start = record.events[0].created_at if record.events else record.view.created_at
    loaded = next((event for event in record.events if event.type == "knowledge_loaded"), None)
    used_library = KnowledgeLibrary.model_validate(loaded.data) if loaded else library
    return ReplayBundle(
        run=record.view.model_copy(deep=True),
        library=used_library.for_surface("customer_chat"),
        frames=[
            ReplayFrame(
                offset_ms=max(0, round((event.created_at - start).total_seconds() * 1000)),
                event=event.model_copy(deep=True),
            )
            for event in record.events
        ],
    )


def load_record(log_dir: Path, run_id: str) -> RunRecord:
    """Load an archived run for export, without restarting models or target sessions."""
    view = RunView.model_validate_json((log_dir / run_id / "run.json").read_text())
    events = [
        RunEvent.model_validate_json(line)
        for line in (log_dir / f"{run_id}.jsonl").read_text().splitlines()
    ]
    return RunRecord(view=view, log_dir=log_dir, events=events)
