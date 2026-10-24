"""Run a live local demo or export an archived run for frontend playback."""

import argparse
import asyncio
from pathlib import Path

import httpx

from attacker_agent.browser_demo import BrowserOptions, run_browser
from attacker_agent.clients import ModelClient, TargetClient
from attacker_agent.events import RunRecord
from attacker_agent.knowledge import load_library
from attacker_agent.models import CreateRun, Limits, RunView
from attacker_agent.replay import build_replay, load_record
from attacker_agent.runner import Runner
from attacker_agent.settings import Settings, load_settings


async def _run(settings: Settings, arguments: argparse.Namespace) -> RunRecord:
    if settings.api_key is None:
        raise SystemExit("Configure ABLITERATION_API_KEY before running a live demo.")
    request = CreateRun(
        account_identifier=arguments.account,
        attacker_email=arguments.attacker_email,
        limits=Limits(
            max_steps=arguments.max_steps,
            max_sessions=arguments.max_sessions,
            max_seconds=arguments.max_seconds,
        ),
    )
    record = RunRecord(RunView(model=settings.model, request=request), settings.log_dir)
    print(f"Live run: {record.view.id}", flush=True)
    print(f"Event log: {settings.log_dir / (record.view.id + '.jsonl')}", flush=True)
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        if arguments.action == "browser":
            await run_browser(
                record,
                client,
                settings,
                BrowserOptions(
                    frontend_url=arguments.url,
                    headless=arguments.headless,
                    typing_delay_ms=arguments.typing_delay_ms,
                    hold_seconds=arguments.hold_seconds,
                    show_notebook_overlay=arguments.show_notebook_overlay,
                ),
            )
        else:
            await Runner(
                record,
                ModelClient(client, settings),
                TargetClient(client, str(settings.target_base_url)),
                settings,
            ).run()
    return record


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_subparsers(dest="action", required=True)
    live = actions.add_parser("run", help="Run real providers against the configured support demo")
    browser = actions.add_parser("browser", help="Watch a real attack in a visible Chromium window")
    browser.add_argument("--url", default="http://127.0.0.1:5174")
    browser.add_argument(
        "--headless",
        action="store_true",
        help="Record the real UI without a desktop window; avoids desktop resizing during capture",
    )
    browser.add_argument("--typing-delay-ms", type=int, default=12)
    browser.add_argument("--hold-seconds", type=float, default=15)
    browser.add_argument(
        "--show-notebook-overlay",
        action="store_true",
        help="Show development notes on the target page; omit for clean recordings",
    )
    for action in (live, browser):
        action.add_argument("--reasoning-effort", choices=("none", "low", "high", "max"))
        action.add_argument("--feedback-mode", choices=("reply_only", "network_receipts"))
        action.add_argument("--expect-target-model")
        action.add_argument("--account", default="alex@example.com")
        action.add_argument("--attacker-email", default="attacker@example.com")
        action.add_argument("--max-steps", type=int, default=20)
        action.add_argument("--max-sessions", type=int, default=3)
        action.add_argument("--max-seconds", type=float, default=300)
    archive = actions.add_parser("export", help="Export an archived run without model calls")
    archive.add_argument("run_id")
    for action in (live, browser, archive):
        action.add_argument("--output", type=Path)
    arguments = parser.parse_args()
    settings = load_settings()
    if arguments.action != "export":
        overrides = {
            key: value
            for key, value in {
                "reasoning_effort": arguments.reasoning_effort,
                "feedback_mode": arguments.feedback_mode,
                "expected_target_model": arguments.expect_target_model,
            }.items()
            if value is not None
        }
        settings = settings.model_copy(update=overrides)
    record = (
        asyncio.run(_run(settings, arguments))
        if arguments.action != "export"
        else load_record(settings.log_dir, arguments.run_id)
    )
    output = arguments.output or settings.log_dir / record.view.id / "replay.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(build_replay(record, load_library()).model_dump_json(indent=2) + "\n")
    for step in record.view.steps:
        print(f"{step.id}: {step.decision.phase} / {step.decision.strategy} / {step.status}")
    print(f"Objective: {record.view.objective.status}; stopped: {record.view.stop_reason}")
    print(f"Notes: {len(record.view.knowledge.notes)}; replay: {output.resolve()}")


if __name__ == "__main__":
    main()
