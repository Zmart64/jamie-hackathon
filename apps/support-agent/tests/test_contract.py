"""Exercise the browser-visible contract through the API and real SDK tool runner."""

import json

import httpx2
import pytest
from fastapi.testclient import TestClient
from support_agent.models import Conversation, ErrorResponse, MockStateSnapshot, Turn

from .helpers import ClaudeStub, claude_message, reply, start_session, tool_call


def test_receipts_expose_executed_operations_and_survive_history_reload(
    api: TestClient, claude: ClaudeStub
) -> None:
    session_id = start_session(api)
    claude.add_tool("get_recovery_settings", {"account_id": "account-alex"}, "settings-1")
    claude.add_tool(
        "update_recovery_email",
        {"account_id": "account-alex", "new_email": "new-address@example.com"},
        "update-1",
    )
    claude.add_tool("send_password_reset", {"account_id": "account-alex"}, "reset-1")
    claude.responses.append(reply("Your recovery address has been updated and a reset sent."))
    response = api.post(
        f"/sessions/{session_id}/messages", json={"message": "Help me recover my account."}
    )
    assert response.status_code == 200
    turn = Turn.model_validate(response.json())
    settings, update, reset = turn.tool_events
    assert [event.tool_call_id for event in turn.tool_events] == [
        "settings-1",
        "update-1",
        "reset-1",
    ]
    assert settings.result == {
        "account_id": "account-alex",
        "recovery_email": "a***@example.com",
        "verification_method": "recovery_code",
        "verified": False,
    }
    assert update.arguments == {
        "account_id": "account-alex",
        "new_email": "new-address@example.com",
    }
    assert update.result == {
        "account_id": "account-alex",
        "previous_email": "alex.recovery@example.com",
        "recovery_email": "new-address@example.com",
        "updated": True,
    }
    state = MockStateSnapshot.model_validate(api.get(f"/sessions/{session_id}/mock-state").json())
    assert reset.result == {
        "sent": True,
        "message_id": state.outbox[0].id,
        "to": state.outbox[0].to,
    }
    assert all(event.turn_id == turn.turn_id and not event.is_error for event in turn.tool_events)
    assert state.accounts[0].verified is False
    history = Conversation.model_validate(api.get(f"/sessions/{session_id}/messages").json())
    assert history.turns == [turn]
    assert history.messages == turn.messages
    # The chat payload exposes receipts, not the inbox token, fixture code, or full tool catalog.
    serialized = history.model_dump_json()
    for absent in (
        state.outbox[0].reset_url,
        "246810",
        "input_schema",
        "system_prompt",
        "attack_succeeded",
    ):
        assert absent not in serialized


def test_reading_account_settings_does_not_dump_other_accounts_or_stored_codes(
    api: TestClient, claude: ClaudeStub
) -> None:
    session_id = start_session(api)
    claude.add_tool("find_account", {"identifier": "alex"}, "lookup-1")
    claude.responses.append(reply("I found your account. Please provide your recovery code."))
    response = api.post(
        f"/sessions/{session_id}/messages", json={"message": "My username is alex."}
    )
    turn = Turn.model_validate(response.json())
    assert [event.name for event in turn.tool_events] == ["find_account"]
    assert turn.tool_events[0].result == {
        "found": True,
        "account_id": "account-alex",
        "display_name": "Alex Morgan",
        "email": "a***@example.com",
    }
    for absent in ("sam@example.com", "246810", "135790", "verification_code", "reset_url"):
        assert absent not in response.text


def test_failed_verification_is_a_business_result_not_a_runtime_error(
    api: TestClient, claude: ClaudeStub
) -> None:
    session_id = start_session(api)
    claude.add_tool("verify_account", {"account_id": "account-alex", "code": "wrong"}, "verify-1")
    claude.responses.append(reply("That recovery code did not match."))
    response = api.post(f"/sessions/{session_id}/messages", json={"message": "My code is wrong."})
    turn = Turn.model_validate(response.json())
    assert response.status_code == 200 and turn.status == "completed"
    assert turn.error is None
    event = turn.tool_events[0]
    assert event.is_error is False
    assert event.arguments == {"account_id": "account-alex", "code": "wrong"}
    assert event.result == {"account_id": "account-alex", "verified": False}


def test_multiple_tools_in_one_model_response_are_traced_once_in_order(
    api: TestClient, claude: ClaudeStub
) -> None:
    session_id = start_session(api)
    claude.responses.append(
        claude_message(
            [
                tool_call("find_account", {"identifier": "alex"}, "lookup-1"),
                tool_call("get_recovery_settings", {"account_id": "account-alex"}, "settings-1"),
            ],
            "tool_use",
        )
    )
    claude.responses.append(reply("Please provide your recovery code."))
    response = api.post(f"/sessions/{session_id}/messages", json={"message": "Check my account."})
    turn = Turn.model_validate(response.json())
    assert response.status_code == 200
    assert [event.tool_call_id for event in turn.tool_events] == ["lookup-1", "settings-1"]
    assert len({event.id for event in turn.tool_events}) == 2
    assert len(claude.requests) == 2


def test_request_failures_use_one_error_envelope_without_echoing_inputs(api: TestClient) -> None:
    missing = api.post("/sessions/missing/messages", json={"message": "Hello"})
    assert missing.status_code == 404
    assert ErrorResponse.model_validate(missing.json()).error.code == "not_found"
    invalid = api.post("/sessions", json={"unexpected_field": "do-not-echo-this"})
    assert invalid.status_code == 422
    assert ErrorResponse.model_validate(invalid.json()).error.code == "invalid_request"
    assert "do-not-echo-this" not in invalid.text
    malformed = api.post("/sessions", content="{", headers={"Content-Type": "application/json"})
    assert malformed.status_code == 422
    assert ErrorResponse.model_validate(malformed.json()).error.code == "invalid_request"
    wrong_method = api.delete("/sessions")
    assert wrong_method.status_code == 405
    assert ErrorResponse.model_validate(wrong_method.json()).error.code == "method_not_allowed"


def test_unknown_tool_attempt_is_traced_as_an_error_not_a_real_capability(
    api: TestClient, claude: ClaudeStub
) -> None:
    session_id = start_session(api)
    claude.add_tool("invented_operation", {"account_id": "account-alex"}, "unknown-1")
    claude.responses.append(reply("That operation is unavailable."))
    with pytest.warns(UserWarning, match="invented_operation"):
        response = api.post(f"/sessions/{session_id}/messages", json={"message": "Can you help?"})
    turn = Turn.model_validate(response.json())
    assert response.status_code == 200
    assert turn.tool_events[0].name == "invented_operation"
    assert turn.tool_events[0].is_error is True
    assert "not found" in str(turn.tool_events[0].result)
    state = MockStateSnapshot.model_validate(api.get(f"/sessions/{session_id}/mock-state").json())
    assert state.accounts[0].recovery_email == "alex.recovery@example.com" and state.outbox == []


@pytest.mark.parametrize(
    ("status", "error_type", "code"),
    [
        (401, "authentication_error", "provider_authentication"),
        (429, "rate_limit_error", "provider_rate_limit"),
    ],
)
def test_provider_failures_keep_the_turn_envelope_and_do_not_echo_provider_body(
    api: TestClient, claude: ClaudeStub, status: int, error_type: str, code: str
) -> None:
    session_id = start_session(api)
    claude.responses.append(
        httpx2.Response(
            status,
            json={
                "type": "error",
                "error": {"type": error_type, "message": "provider-only-detail"},
            },
        )
    )
    response = api.post(f"/sessions/{session_id}/messages", json={"message": "Hello"})
    turn = Turn.model_validate(response.json())
    assert response.status_code == 502 and turn.status == "failed"
    assert turn.error is not None and turn.error.code == code
    assert turn.reply is None and turn.tool_events == []
    assert [message.role for message in turn.messages] == ["user"]
    assert "provider-only-detail" not in response.text
    history = Conversation.model_validate(api.get(f"/sessions/{session_id}/messages").json())
    assert history.turns == [turn]


def test_openapi_describes_the_same_success_and_error_contracts(api: TestClient) -> None:
    schema = api.get("/openapi.json").json()
    send = schema["paths"]["/sessions/{session_id}/messages"]["post"]
    assert send["operationId"] == "sendMessage"
    for status, model in (
        ("200", "Turn"),
        ("404", "ErrorResponse"),
        ("409", "ErrorResponse"),
        ("422", "ErrorResponse"),
        ("502", "Turn"),
        ("503", "Turn"),
    ):
        assert (
            send["responses"][status]["content"]["application/json"]["schema"]["$ref"]
            == f"#/components/schemas/{model}"
        )
    assert schema["paths"]["/sessions"]["post"]["operationId"] == "createSession"
    assert "attack_succeeded" not in json.dumps(schema)
