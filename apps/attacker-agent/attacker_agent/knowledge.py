"""Load packaged, curated knowledge. Agent decisions cannot modify this library."""

from pathlib import Path

from attacker_agent.knowledge_models import KnowledgeEntry, KnowledgeKind, KnowledgeLibrary
from attacker_agent.settings import PACKAGE_DIR

KNOWLEDGE_DIR = PACKAGE_DIR / "knowledge_base"
CATEGORIES: dict[str, KnowledgeKind] = {
    "techniques": "technique",
    "lessons": "lesson",
    "mutations": "mutation",
    "search_methods": "search_method",
}


def load_library(directory: Path = KNOWLEDGE_DIR) -> KnowledgeLibrary:
    entries: list[KnowledgeEntry] = []
    for folder, kind in CATEGORIES.items():
        paths = sorted((directory / folder).glob("*.json"))
        if not paths:
            raise ValueError(f"Knowledge category is empty or missing: {folder}")
        for path in paths:
            entry = KnowledgeEntry.model_validate_json(path.read_text(encoding="utf-8"))
            if entry.kind != kind or path.stem != entry.id:
                raise ValueError(f"Knowledge filename/category does not match its record: {path}")
            entries.append(entry)
    ids = [entry.id for entry in entries]
    if len(ids) != len(set(ids)):
        raise ValueError("Knowledge IDs must be unique across categories.")
    techniques = {entry.id for entry in entries if entry.kind == "technique"}
    for entry in entries:
        if set(entry.related_techniques) - techniques:
            raise ValueError(f"Unknown related technique in knowledge entry: {entry.id}")
    return KnowledgeLibrary(entries=entries)
