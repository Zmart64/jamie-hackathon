"""Schemas for curated attack knowledge and evidence-linked, run-local notes."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

KnowledgeText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
KnowledgeKey = Annotated[KnowledgeText, Field(pattern=r"^[a-z0-9][a-z0-9_-]*$", max_length=80)]
KnowledgeSurface = Literal[
    "customer_chat", "retrieved_content", "tool_response", "tool_metadata", "persistent_memory"
]
KnowledgeKind = Literal["technique", "lesson", "mutation", "search_method"]


class KnowledgeSource(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reference: KnowledgeText
    evidence_kind: Literal["benchmark", "demonstration", "design_principle", "local_observation"]
    note: KnowledgeText


class KnowledgeEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: KnowledgeKey
    kind: KnowledgeKind
    title: KnowledgeText
    description: KnowledgeText
    surfaces: list[KnowledgeSurface]
    when_to_try: list[KnowledgeText] = Field(min_length=1)
    prerequisites: list[KnowledgeText] = Field(min_length=1)
    limitations: list[KnowledgeText] = Field(min_length=1)
    sources: list[KnowledgeSource] = Field(min_length=1)
    related_techniques: list[KnowledgeKey] = Field(default_factory=list[KnowledgeKey])


class KnowledgeLibrary(BaseModel):
    schema_version: Literal[1] = 1
    entries: list[KnowledgeEntry]

    def for_surface(self, surface: KnowledgeSurface) -> KnowledgeLibrary:
        """An empty surface list denotes guidance that applies across surfaces."""
        return KnowledgeLibrary(
            entries=[
                entry for entry in self.entries if not entry.surfaces or surface in entry.surfaces
            ]
        )


class ReplyEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    step_id: int = Field(ge=1)
    quote: Annotated[KnowledgeText, Field(max_length=1000)]


class KnowledgeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    key: KnowledgeKey
    kind: Literal["observation", "hypothesis", "next_probe"]
    statement: Annotated[KnowledgeText, Field(max_length=800)]
    scope: Literal["session", "run"] = "session"
    status: Literal["active", "discarded"] = "active"
    evidence: list[ReplyEvidence] = Field(min_length=1, max_length=5)


class KnowledgeNote(KnowledgeUpdate):
    session_id: str | None
    updated_at_step: int = Field(ge=1)


class KnowledgeUpdateResult(BaseModel):
    key: str
    accepted: bool
    reason: str


class RunKnowledge(BaseModel):
    """Model interpretations; exact-quote validation never establishes backend effects."""

    active_session_id: str | None = None
    notes: list[KnowledgeNote] = Field(default_factory=list[KnowledgeNote], max_length=100)
    last_update_results: list[KnowledgeUpdateResult] = Field(
        default_factory=list[KnowledgeUpdateResult], max_length=5
    )

    def for_planner(self) -> RunKnowledge:
        return self.model_copy(
            update={
                "notes": [
                    note
                    for note in self.notes
                    if note.status == "active"
                    and (note.scope == "run" or note.session_id == self.active_session_id)
                ]
            }
        )
