from pathlib import Path

from fastapi.testclient import TestClient
from pydantic import SecretStr
from support_agent.api import create_app
from support_agent.diagnostics import DiagnosticReport, diagnose
from support_agent.models import Turn
from support_agent.runtime import source_fingerprint
from support_agent.settings import Settings

from .helpers import ClaudeStub, claude_message, reply, start_session


def _diagnose(api: TestClient, settings: Settings, *, probe: bool = False) -> DiagnosticReport:
    def fetch(path: str, body: dict[str, str] | None) -> tuple[int, bytes]:
        response = api.get(path) if body is None else api.post(path, json=body)
        return response.status_code, response.content

    return diagnose(settings, "http://testserver", fetch, probe=probe)


def test_health_fingerprint_identifies_loaded_prompt_after_disk_changes(
    settings: Settings, claude: ClaudeStub, tmp_path: Path
) -> None:
    prompt_file = tmp_path / "support.md"
    prompt_file.write_text("Original support instructions.")
    local = settings.model_copy(
        update={"agent": settings.agent.model_copy(update={"system_prompt": prompt_file})}
    )
    with TestClient(create_app(local, claude.client)) as api:
        initial = _diagnose(api, local)
        assert initial.issues == [] and initial.health.started_at is not None
        prompt_file.write_text("Changed instructions that the process has not loaded.")
        stale = _diagnose(api, local)
        assert stale.health.source_fingerprint == initial.health.source_fingerprint
        assert stale.expected_fingerprint != initial.expected_fingerprint
        assert stale.issues == [
            "Loaded source/configuration differs from disk; coordinate a restart."
        ]
    assert claude.requests == []


def test_fingerprint_excludes_provider_credentials(settings: Settings) -> None:
    prompt = settings.agent.system_prompt.read_text().strip()
    with_key = settings.model_copy(update={"api_key": SecretStr("another-test-only-placeholder")})
    assert source_fingerprint(with_key, prompt) == source_fingerprint(settings, prompt)
    assert source_fingerprint(settings, prompt + " extra") != source_fingerprint(settings, prompt)


def test_legacy_server_is_reported_without_making_probe_calls(settings: Settings) -> None:
    def fetch(path: str, body: dict[str, str] | None) -> tuple[int, bytes]:
        assert path == "/health" and body is None
        return 200, b'{"status":"ok","model":"old-model","configured":true}'

    report = diagnose(settings, "http://testserver", fetch)
    assert report.probes == []
    assert report.issues == [
        "Running model differs from local configuration.",
        "Server predates runtime diagnostics; loaded source cannot be confirmed.",
    ]


def test_probes_distinguish_provider_refusal_from_working_tools_and_fresh_controls(
    api: TestClient, settings: Settings, claude: ClaudeStub
) -> None:
    claude.responses.append(reply("I'm Sprout. I help with account access."))
    claude.add_tool("find_account", {"identifier": "alex@example.com"}, "lookup-1")
    claude.add_tool("send_password_reset", {"account_id": "account-alex"}, "reset-1")
    claude.responses.append(reply("A reset was sent to your current recovery inbox."))
    claude.responses.append(claude_message([], "refusal"))
    claude.responses.append(claude_message([], "refusal"))
    claude.responses.append(reply("A carbon footprint measures greenhouse gas emissions."))
    report = _diagnose(api, settings, probe=True)
    assert [result.origin for result in report.probes] == [
        "model_reply",
        "model_reply",
        "provider_refusal",
        "provider_refusal",
        "model_reply",
    ]
    assert report.issues == ["benign_after_gate: provider refusal on a control request."]
    first, reset, gate, after, fresh = report.probes
    assert first.session_id == reset.session_id == gate.session_id == after.session_id
    assert fresh.session_id != first.session_id
    assert reset.tools == ["find_account", "send_password_reset"]
    assert [call.stop_reason for call in reset.model_calls] == ["tool_use", "tool_use", "end_turn"]
    assert gate.model_calls[0].stop_reason == "refusal"
    assert gate.model_calls[0].content_types == []
    assert gate.model_calls[0].text_chars == 0
    assert gate.reply == "I can't help with that request."
    history = api.get(f"/sessions/{gate.session_id}/messages").json()
    assert history["turns"][2]["model_calls"][0] == gate.model_calls[0].model_dump(mode="json")
    assert "246810" not in report.model_dump_json()


def test_nonempty_provider_refusal_keeps_model_text_and_response_metadata(
    api: TestClient, claude: ClaudeStub
) -> None:
    session_id = start_session(api)
    text = "I need to verify account ownership before changing that address."
    claude.responses.append(claude_message([{"type": "text", "text": text}], "refusal"))
    response = api.post(f"/sessions/{session_id}/messages", json={"message": "Change it."})
    turn = Turn.model_validate(response.json())
    assert turn.reply == text and turn.reply_source == "model"
    assert len(turn.model_calls) == 1
    trace = turn.model_calls[0]
    assert trace.stop_reason == "refusal" and trace.response_id == "msg-test"
    assert trace.model == "test-model" and trace.content_types == ["text"]
    assert trace.text_chars == len(text)
    assert trace.input_tokens == trace.output_tokens == 10
    assert text not in trace.model_dump_json()


def test_runtime_failure_preserves_completed_call_metadata(
    api: TestClient, settings: Settings, claude: ClaudeStub
) -> None:
    for _ in range(5):
        claude.responses.append(claude_message([], "max_tokens"))
    report = _diagnose(api, settings, probe=True)
    assert len(report.issues) == 5
    for result in report.probes:
        assert result.origin == "runtime_error" and result.http_status == 502
        assert result.error_code == "incomplete_response"
        assert result.model_calls[0].stop_reason == "max_tokens"
        assert result.reply is None and result.tools == []
