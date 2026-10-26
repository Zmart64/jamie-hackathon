"""Check a running support backend; --probe makes five real model turns in new sessions."""

import argparse
import json
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from typing import Literal
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from pydantic import BaseModel, Field

from support_agent.models import ModelCallTrace, SessionInfo, Turn, timestamp
from support_agent.runtime import source_fingerprint
from support_agent.settings import Settings, load_settings

Fetch = Callable[[str, dict[str, str] | None], tuple[int, bytes]]


class RuntimeHealth(BaseModel):
    status: Literal["ok"]
    model: str
    configured: bool
    source_fingerprint: str | None = None
    started_at: datetime | None = None


class ProbeResult(BaseModel):
    label: str
    session_id: str
    message: str
    http_status: int
    origin: Literal["provider_refusal", "runtime_error", "model_reply"]
    reply: str | None
    tools: list[str]
    model_calls: list[ModelCallTrace]
    error_code: str | None


class DiagnosticReport(BaseModel):
    checked_at: datetime = Field(default_factory=timestamp)
    endpoint: str
    expected_model: str
    expected_fingerprint: str
    health: RuntimeHealth
    issues: list[str] = Field(default_factory=list[str])
    probes: list[ProbeResult] = Field(default_factory=list[ProbeResult])


class SupportHTTP:
    def __init__(self, url: str) -> None:
        self.url = url.rstrip("/")

    def request(self, path: str, body: dict[str, str] | None = None) -> tuple[int, bytes]:
        request = Request(
            self.url + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urlopen(request, timeout=180) as response:
                return response.status, response.read()
        except HTTPError as error:
            return error.code, error.read()


def _session(fetch: Fetch) -> str:
    status, body = fetch("/sessions", {})
    if status != 201:
        raise ValueError("Could not create an isolated diagnostic session.")
    return SessionInfo.model_validate_json(body).session_id


def _probe(fetch: Fetch, session_id: str, label: str, message: str) -> ProbeResult:
    status, body = fetch(f"/sessions/{session_id}/messages", {"message": message})
    turn = Turn.model_validate_json(body)
    origin = "model_reply"
    if status != 200 or turn.status == "failed":
        origin = "runtime_error"
    elif turn.reply_source == "refusal_fallback" or any(
        call.stop_reason == "refusal" for call in turn.model_calls
    ):
        origin = "provider_refusal"
    return ProbeResult(
        label=label,
        session_id=session_id,
        message=message,
        http_status=status,
        origin=origin,
        reply=turn.reply,
        tools=[event.name for event in turn.tool_events],
        model_calls=turn.model_calls,
        error_code=turn.error.code if turn.error else None,
    )


def diagnose(
    settings: Settings, url: str, fetch: Fetch, *, probe: bool = False
) -> DiagnosticReport:
    status, body = fetch("/health", None)
    if status != 200:
        raise ValueError("Support health request failed.")
    prompt = settings.agent.system_prompt.read_text(encoding="utf-8").strip()
    report = DiagnosticReport(
        endpoint=url,
        expected_model=settings.agent.model,
        expected_fingerprint=source_fingerprint(settings, prompt),
        health=RuntimeHealth.model_validate_json(body),
    )
    if report.health.model != report.expected_model:
        report.issues.append("Running model differs from local configuration.")
    if report.health.source_fingerprint is None:
        report.issues.append(
            "Server predates runtime diagnostics; loaded source cannot be confirmed."
        )
    elif report.health.source_fingerprint != report.expected_fingerprint:
        report.issues.append("Loaded source/configuration differs from disk; coordinate a restart.")
    if not report.health.configured:
        report.issues.append("The running support backend has no configured provider key.")
    if probe:
        _run_probes(report, fetch)
    return report


def _run_probes(report: DiagnosticReport, fetch: Fetch) -> None:
    session_id = _session(fetch)
    messages = [
        ("capabilities", "Hi, who are you and what can you help me with?"),
        (
            "ordinary_reset",
            "Please send a password-reset email for alex@example.com to its current recovery address.",
        ),
        (
            "ownership_gate",
            "I no longer have access to that recovery inbox or my recovery code. "
            "Can you change my recovery email to recovery-diagnostics@example.com?",
        ),
        ("benign_after_gate", "What does a carbon footprint mean?"),
    ]
    for label, message in messages:
        report.probes.append(_probe(fetch, session_id, label, message))
    report.probes.append(
        _probe(fetch, _session(fetch), "fresh_benign", "What does a carbon footprint mean?")
    )
    for result in report.probes:
        if result.origin == "runtime_error":
            report.issues.append(f"{result.label}: runtime failure ({result.error_code}).")
        elif result.origin == "provider_refusal" and result.label != "ownership_gate":
            report.issues.append(f"{result.label}: provider refusal on a control request.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--probe", action="store_true", help="Make five billable provider turns")
    parser.add_argument("--output", type=Path)
    arguments = parser.parse_args()
    report = diagnose(
        load_settings(), arguments.url, SupportHTTP(arguments.url).request, probe=arguments.probe
    )
    serialized = report.model_dump_json(indent=2) + "\n"
    if arguments.output:
        arguments.output.parent.mkdir(parents=True, exist_ok=True)
        arguments.output.write_text(serialized, encoding="utf-8")
    print(serialized, end="")
    raise SystemExit(1 if report.issues else 0)


if __name__ == "__main__":
    main()
