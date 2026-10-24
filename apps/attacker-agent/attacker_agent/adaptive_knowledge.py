"""Validate and persist notes from application-exposed observations within one run."""

import json

from attacker_agent.events import RunRecord, as_data
from attacker_agent.knowledge_models import KnowledgeNote, KnowledgeUpdate, KnowledgeUpdateResult


class AdaptiveKnowledge:
    def __init__(self, record: RunRecord) -> None:
        self.record = record
        self.knowledge = record.view.knowledge

    def start_session(self, session_id: str) -> None:
        self.knowledge.active_session_id = session_id
        self.knowledge.last_update_results = []
        self._save()

    def apply(self, updates: list[KnowledgeUpdate], step_id: int) -> list[KnowledgeUpdate]:
        accepted: list[KnowledgeUpdate] = []
        results: list[KnowledgeUpdateResult] = []
        for update in updates:
            reason = self._validate_evidence(update, step_id)
            if reason is None:
                reason = self._upsert(update, step_id)
            result = KnowledgeUpdateResult(
                key=update.key, accepted=reason is None, reason=reason or "saved"
            )
            results.append(result)
            if result.accepted:
                accepted.append(update)
            else:
                self.record.emit("knowledge_update_rejected", as_data(result), step_id)
        self.knowledge.last_update_results = results
        if updates:
            self._save()
        return accepted

    def _validate_evidence(self, update: KnowledgeUpdate, step_id: int) -> str | None:
        for evidence in update.evidence:
            source = next(
                (step for step in self.record.view.steps if step.id == evidence.step_id), None
            )
            if (
                source is None
                or source.id >= step_id
                or source.status != "completed"
                or source.reply is None
                or evidence.quote not in source.evidence_text()
            ):
                return (
                    "Evidence must quote a completed, earlier application observation in this run."
                )
            if update.scope == "session" and source.session_id != self.knowledge.active_session_id:
                return "Session-scoped notes require evidence from the current target session."
        return None

    def _upsert(self, update: KnowledgeUpdate, step_id: int) -> str | None:
        note = KnowledgeNote(
            **update.model_dump(),
            session_id=self.knowledge.active_session_id if update.scope == "session" else None,
            updated_at_step=step_id,
        )
        index = next(
            (
                index
                for index, previous in enumerate(self.knowledge.notes)
                if (previous.key, previous.scope, previous.session_id)
                == (note.key, note.scope, note.session_id)
            ),
            None,
        )
        if index is not None:
            self.knowledge.notes[index] = note
        elif len(self.knowledge.notes) < 100:
            self.knowledge.notes.append(note)
        else:
            return "Run knowledge has reached its 100-note limit; revise an existing key."
        self.record.emit("knowledge_updated", as_data(note), step_id)
        return None

    def _save(self) -> None:
        directory = self.record.log_dir / self.record.view.id
        directory.mkdir(parents=True, exist_ok=True)
        snapshot = {"run_id": self.record.view.id, "knowledge": as_data(self.knowledge)}
        temporary = directory / "knowledge.json.tmp"
        temporary.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
        temporary.replace(directory / "knowledge.json")
