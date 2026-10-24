"""An opt-in development overlay; clean recordings keep notes off the target page."""

import asyncio
from contextlib import suppress
from html import escape

from playwright.async_api import Page

from attacker_agent.events import RunRecord
from attacker_agent.knowledge_models import KnowledgeNote

PANEL_STYLE = """
:host { all: initial; color-scheme: light; }
* { box-sizing: border-box; }
section { background: #f8faf8; color: #193c2b; border: 1px solid #d6e2da;
  border-radius: 18px; padding: 24px; font: 14px/1.5 Inter, system-ui, sans-serif;
  height: 100%; overflow-y: auto; box-shadow: 0 18px 65px #122a1924; }
h1 { font-size: 23px; line-height: 1.2; margin: 8px 0 12px; font-weight: 600; }
h2 { font-size: 13px; margin: 20px 0 8px; letter-spacing: .06em; text-transform: uppercase; }
p { margin: 5px 0 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
.eyebrow, small { color: #53695c; font-size: 12px; }
.eyebrow { letter-spacing: .08em; font-weight: 600; }
.status { padding: 9px 12px; background: #e4eee6; border-radius: 9px; }
article { margin: 12px 0; padding-top: 12px; border-top: 1px solid #d6e2da; }
blockquote { margin: 8px 0 0; padding: 0 0 0 10px; border-left: 2px solid #8aaa94;
  color: #486552; font-size: 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
summary { cursor: pointer; color: #53695c; font-size: 12px; }
"""

MOUNT_PANEL = """(html) => {
  let host = document.getElementById('strain-operator-notebook');
  if (!host) {
    host = document.createElement('div');
    host.id = 'strain-operator-notebook';
    host.style.cssText = 'position:fixed;left:24px;top:24px;bottom:24px;' +
      'width:min(580px,calc(100vw - 600px));z-index:2147483647;';
    document.body.appendChild(host);
    host.attachShadow({mode:'open'});
  }
  host.shadowRoot.innerHTML = html;
}"""


def note_html(note: KnowledgeNote) -> str:
    evidence = "".join(
        f"<blockquote>Reply {item.step_id}: {escape(item.quote)}</blockquote>"
        for item in note.evidence
    )
    return (
        f"<article><small>{escape(note.kind)} · {escape(note.scope)} "
        f"· updated at decision {note.updated_at_step}</small>"
        f"<p>{escape(note.statement)}</p><details><summary>Source evidence</summary>"
        f"{evidence}</details></article>"
    )


def panel_html(record: RunRecord, event_label: str) -> str:
    view = record.view
    step = view.steps[-1] if view.steps else None
    notes = sorted(
        view.knowledge.for_planner().notes, key=lambda note: note.updated_at_step, reverse=True
    )
    experiment = "<p>Opening the real support chat…</p>"
    if step:
        decision = step.decision
        experiment = (
            f"<small>Decision {step.id} · {escape(decision.phase.replace('_', ' '))}</small>"
            f"<h1>{escape(decision.strategy)}</h1>"
            f"<h2>Hypothesis</h2><p>{escape(decision.hypothesis)}</p>"
            f"<h2>Adaptation</h2><p>{escape(decision.adaptation)}</p>"
            f"<small>Expected signal: {escape(decision.expected_signal)}</small>"
        )
    status = {
        "achieved": "Confirmed: reset delivered to the attacker inbox",
        "recovery_redirected": "Partial progress: recovery changed; reset delivery still needed",
        "not_observed": "No verified reset redirection observed",
    }[view.objective.status]
    body = "".join(note_html(note) for note in notes[:4]) or "<p>No accepted notes yet.</p>"
    return (
        f"<style>{PANEL_STYLE}</style><section aria-label='Attacker live notebook'>"
        f"<div class='eyebrow'>LIVE ATTACKER · REAL BROWSER</div>"
        f"<small>{escape(view.model)} · run {view.id[:8]} · {escape(view.status)}</small>"
        f"<p class='status'>{escape(event_label)}</p>{experiment}"
        f"<h2>Working notebook · {len(notes)} active notes</h2>{body}"
        f"<h2>Independent observer</h2><p>{escape(status)}</p>"
        "<small>Only the support chat replies enter the attacker's feedback. "
        "This panel shows saved notes and operator verification.</small></section>"
    )


async def follow_browser(record: RunRecord, page: Page) -> None:
    cursor = 0
    while True:
        record.changed.clear()
        if cursor < len(record.events) and (record.view.sessions or record.terminal):
            latest = record.events[-1]
            cursor = len(record.events)
            label = latest.type.replace("_", " ")
            await page.evaluate(MOUNT_PANEL, panel_html(record, label))
        if record.terminal and cursor == len(record.events):
            return
        with suppress(TimeoutError):
            await asyncio.wait_for(record.changed.wait(), timeout=0.5)
