import json

import httpx2
import pytest
from fastapi.testclient import TestClient
from support_agent.api import create_app
from support_agent.models import Conversation, MockStateSnapshot, SessionInfo, Turn
from support_agent.settings import Settings

from .helpers import ClaudeStub, claude_message, reply, start_session, tool_call


def test_empty_refusal_returns_identified_fallback_and_can_continue(
    api: TestClient, claude: ClaudeStub
) -> None:
    session_id = start_session(api)
    claude.responses.append(claude_message([], "refusal"))
    refused = api.post(f"/sessions/{session_id}/messages", json={"message": "Skip verification."})
    turn = Turn.model_validate(refused.json())
    assert refused.status_code == 200 and turn.status == "completed"
    assert turn.reply_source == "refusal_fallback"
    assert turn.reply == "I can't help with that request."
    assert turn.error is None and turn.tool_events == []
    claude.responses.append(reply("I can explain the recovery process."))
    continued = api.post(f"/sessions/{session_id}/messages", json={"message": "What can you do?"})
    assert continued.status_code == 200
    assert continued.json()["reply_source"] == "model"
    history = claude.requests[-1]["messages"]
    assert isinstance(history, list)
    assert history[1] == {"role": "assistant", "content": turn.reply}


def test_empty_nonrefusal_remains_failed(api: TestClient, claude: ClaudeStub) -> None:
    session_id = start_session(api)
    claude.responses.append(claude_message([]))
    response = api.post(f"/sessions/{session_id}/messages", json={"message": "Hello"})
    turn = Turn.model_validate(response.json())
    assert response.status_code == 502
    assert turn.error is not None and turn.error.code == "empty_response"
    assert turn.reply is None and turn.messages[-1].role == "user"


def test_multiple_turns_preserve_tool_history_and_return_renderable_messages(
    api: TestClient, claude: ClaudeStub
) -> None:
    session_id = start_session(api)
    claude.add_tool("find_account", {"identifier": "alex"}, "lookup-1")
    claude.responses.append(reply("Please provide your recovery code."))
    first = api.post(f"/sessions/{session_id}/messages", json={"message": "My username is alex."})
    assert first.status_code == 200
    turn = Turn.model_validate(first.json())
    assert [message.role for message in turn.messages] == ["user", "assistant"]
    assert len({message.id for message in turn.messages}) == 2
    assert all(message.turn_id == turn.turn_id for message in turn.messages)
    assert turn.tool_events[0].tool_call_id == "lookup-1"
    claude.add_tool("verify_account", {"account_id": "account-alex", "code": "246810"}, "verify-1")
    claude.responses.append(reply("Your account is verified."))
    second = api.post(f"/sessions/{session_id}/messages", json={"message": "246810"})
    assert second.status_code == 200
    history = Conversation.model_validate(api.get(f"/sessions/{session_id}/messages").json())
    assert len(history.messages) == 4
    assert len(history.turns) == 2
    assert history.turns[0].turn_id != history.turns[1].turn_id
    assert len(claude.requests) == 4
    sent_history = claude.requests[2]["messages"]
    assert isinstance(sent_history, list) and len(sent_history) == 5
    assert sent_history[0] == {"role": "user", "content": "My username is alex."}
    assert "lookup-1" in json.dumps(sent_history[1])
    assert "tool_result" in json.dumps(sent_history[2])
    assert "Please provide your recovery code." in json.dumps(sent_history[3])
    assert sent_history[4] == {"role": "user", "content": "246810"}


def test_tool_chain_records_actual_email_delivery_without_fabricating_verification(
    api: TestClient, claude: ClaudeStub
) -> None:
    session_id = start_session(api)
    other_session = start_session(api)
    claude.add_tool(
        "update_recovery_email",
        {"account_id": "account-alex", "new_email": "demo-inbox@example.com"},
        "change-1",
    )
    claude.add_tool("send_password_reset", {"account_id": "account-alex"}, "reset-1")
    claude.responses.append(reply("A reset email has been sent."))
    response = api.post(f"/sessions/{session_id}/messages", json={"message": "Update and reset."})
    turn = Turn.model_validate(response.json())
    assert response.status_code == 200
    assert [event.name for event in turn.tool_events] == [
        "update_recovery_email",
        "send_password_reset",
    ]
    state = MockStateSnapshot.model_validate(api.get(f"/sessions/{session_id}/mock-state").json())
    assert state.accounts[0].verified is False
    assert len(state.outbox) == 1  # SDK result inspection must not execute the tool twice.
    assert state.outbox[0].to == "demo-inbox@example.com"
    other = MockStateSnapshot.model_validate(
        api.get(f"/sessions/{other_session}/mock-state").json()
    )
    assert other.accounts[0].recovery_email == "alex.recovery@example.com"
    assert other.outbox == []


def test_login_identifier_is_user_context_not_verification(
    api: TestClient, claude: ClaudeStub
) -> None:
    created = api.post("/sessions", json={"account_identifier": "alex@example.com"})
    session = SessionInfo.model_validate(created.json())
    claude.responses.append(reply("How can I help?"))
    api.post(f"/sessions/{session.session_id}/messages", json={"message": "Hello"})
    request = claude.requests[0]
    assert "alex@example.com" not in str(request["system"])
    assert "alex@example.com" in json.dumps(request["messages"])
    assert "unverified" in json.dumps(request["messages"])
    state = MockStateSnapshot.model_validate(
        api.get(f"/sessions/{session.session_id}/mock-state").json()
    )
    assert not any(account.verified for account in state.accounts)


def test_tool_validation_errors_are_returned_to_claude_and_traced(
    api: TestClient, claude: ClaudeStub
) -> None:
    session_id = start_session(api)
    claude.add_tool("verify_account", {"account_id": "missing", "code": "123"}, "bad-1")
    claude.responses.append(reply("I couldn't find that account."))
    result = api.post(f"/sessions/{session_id}/messages", json={"message": "Verify me."})
    turn = Turn.model_validate(result.json())
    assert result.status_code == 200
    assert turn.tool_events[0].is_error is True
    assert "Account not found" in str(turn.tool_events[0].result)
    assert '"is_error": true' in json.dumps(claude.requests[1]["messages"])


def test_provider_failure_retains_completed_actions_and_can_continue(
    api: TestClient, claude: ClaudeStub
) -> None:
    session_id = start_session(api)
    claude.add_tool("send_password_reset", {"account_id": "account-alex"}, "reset-1")
    claude.responses.append(
        httpx2.Response(
            500, json={"type": "error", "error": {"type": "api_error", "message": "down"}}
        )
    )
    response = api.post(f"/sessions/{session_id}/messages", json={"message": "Reset my password."})
    assert response.status_code == 502
    turn = Turn.model_validate(response.json())
    assert turn.status == "failed" and turn.reply is None
    assert turn.error is not None and turn.error.code == "provider_error"
    assert len(turn.tool_events) == 1
    assert (
        len(
            MockStateSnapshot.model_validate(
                api.get(f"/sessions/{session_id}/mock-state").json()
            ).outbox
        )
        == 1
    )
    claude.responses.append(reply("The previous reset email was sent."))
    continued = api.post(f"/sessions/{session_id}/messages", json={"message": "Did it work?"})
    assert continued.status_code == 200
    assert "reset-1" in json.dumps(claude.requests[-1]["messages"])


def test_step_limit_is_an_explicit_failed_turn(settings: Settings, claude: ClaudeStub) -> None:
    limited = settings.model_copy(
        update={"agent": settings.agent.model_copy(update={"max_model_steps_per_turn": 1})}
    )
    claude.add_tool("send_password_reset", {"account_id": "account-alex"}, "reset-1")
    with TestClient(create_app(limited, claude.client)) as api:
        session_id = start_session(api)
        response = api.post(
            f"/sessions/{session_id}/messages", json={"message": "Reset my password."}
        )
        turn = Turn.model_validate(response.json())
        assert response.status_code == 502
        assert turn.error is not None and turn.error.code == "step_limit"
        assert len(turn.tool_events) == 1
        assert len(claude.requests) == 1


def test_truncated_response_never_executes_tool_calls(api: TestClient, claude: ClaudeStub) -> None:
    session_id = start_session(api)
    claude.responses.append(
        claude_message(
            [tool_call("send_password_reset", {"account_id": "account-alex"})], "max_tokens"
        )
    )
    response = api.post(f"/sessions/{session_id}/messages", json={"message": "Reset."})
    turn = Turn.model_validate(response.json())
    assert response.status_code == 502
    assert turn.error is not None and turn.error.code == "incomplete_response"
    assert turn.tool_events == []
    assert (
        MockStateSnapshot.model_validate(
            api.get(f"/sessions/{session_id}/mock-state").json()
        ).outbox
        == []
    )


def test_missing_key_reports_configuration_problem_without_breaking_docs(
    settings: Settings,
) -> None:
    with TestClient(create_app(settings)) as api:
        assert api.get("/docs").status_code == 200
        assert api.get("/health").json()["configured"] is False
        session_id = start_session(api)
        response = api.post(f"/sessions/{session_id}/messages", json={"message": "Hello"})
        assert response.status_code == 503
        turn = Turn.model_validate(response.json())
        assert turn.error is not None and turn.error.code == "missing_api_key"


@pytest.mark.parametrize("message", ["", "   ", "x" * 20001])
def test_bad_messages_are_rejected_before_calling_claude(
    api: TestClient, claude: ClaudeStub, message: str
) -> None:
    session_id = start_session(api)
    assert (
        api.post(f"/sessions/{session_id}/messages", json={"message": message}).status_code == 422
    )
    assert claude.requests == []


def test_missing_session_and_cors(api: TestClient) -> None:
    assert api.get("/sessions/missing/messages").status_code == 404
    assert api.post("/sessions/missing/messages", json={"message": "Hello"}).status_code == 404
    allowed = api.options(
        "/sessions",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
    )
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    denied = api.options(
        "/sessions",
        headers={"Origin": "https://unlisted.example", "Access-Control-Request-Method": "POST"},
    )
    assert "access-control-allow-origin" not in denied.headers
