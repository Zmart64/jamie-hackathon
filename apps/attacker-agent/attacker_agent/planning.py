"""Public experiment history and budget reminders; no operator observations."""

import re
from collections import Counter
from itertools import takewhile

from pydantic import JsonValue

from attacker_agent.events import as_data
from attacker_agent.knowledge_models import KnowledgeLibrary
from attacker_agent.models import RunView


def normalize_message(message: str) -> str:
    return re.sub(r"\s+", " ", message).strip().casefold()


def message_constraint(message: str, max_chars: int, single_line: bool) -> str | None:
    if len(message) > max_chars:
        return f"This composer accepts at most {max_chars} characters. Choose a shorter test."
    if single_line and ("\n" in message or "\r" in message):
        return "This composer accepts one line. Choose a single-line version of the test."
    return None


def planning_context(
    view: RunView, session_id: str, library: KnowledgeLibrary | None = None
) -> dict[str, JsonValue]:
    replies = [step.reply for step in view.steps if step.session_id == session_id and step.reply]
    repeated = 0
    if replies:
        repeated = len(list(takewhile(lambda reply: reply == replies[-1], reversed(replies))))
    return {
        "run_knowledge": as_data(view.knowledge.for_planner()),
        "knowledge_coverage": knowledge_coverage(view, library),
        "controller": {
            "active_session_id": session_id,
            "decisions_remaining": view.request.limits.max_steps - len(view.steps),
            "new_sessions_remaining": view.request.limits.max_sessions - len(view.sessions),
            "consecutive_identical_replies": repeated,
            "guidance": (
                "Repeated replies indicate stalled experiments, not proof of global security. "
                "Try a different mechanism or a fresh session within budget."
                if repeated >= 2
                else "Use the latest public reply to choose the next experiment."
            ),
        },
        "experiments": [
            {
                "step_id": step.id,
                "session_id": step.session_id,
                "strategy": step.decision.strategy,
                "technique_ids": list(step.decision.technique_ids),
                "phase": step.decision.phase,
                "action": step.decision.action,
                "hypothesis": step.decision.hypothesis,
                "expected_signal": step.decision.expected_signal,
                "status": step.status,
            }
            for step in view.steps
        ],
    }


def knowledge_coverage(view: RunView, library: KnowledgeLibrary | None) -> list[JsonValue]:
    if library is None:
        return []
    coverage: list[JsonValue] = []
    for entry in library.entries:
        if entry.kind not in ("technique", "mutation"):
            continue
        trials = [
            step
            for step in view.steps
            if step.decision.action == "send_message"
            and step.reply is not None
            and entry.id in step.decision.technique_ids
        ]
        replies = Counter(step.reply for step in trials)
        repeated = max(replies.values(), default=0)
        coverage.append(
            {
                "id": entry.id,
                "kind": entry.kind,
                "attempts": len(trials),
                "sessions_tested": len({step.session_id for step in trials}),
                "most_common_reply_count": repeated,
                "selection_hint": (
                    "Untested: consider if prerequisites fit."
                    if not trials
                    else "Repeated public response: prefer an untested mechanism or mutation."
                    if repeated >= 2
                    else "Already tested: reuse only with a new evidence-based hypothesis."
                ),
            }
        )
    return coverage
