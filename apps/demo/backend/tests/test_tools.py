import json

import pytest
from support_agent.settings import Settings
from support_agent.store import SessionStore
from support_agent.tools import MockTools


def test_mock_mutations_are_permissive_stateful_and_isolated(settings: Settings) -> None:
    store = SessionStore(settings.agent.accounts_file, settings.agent.model)
    session = store.create()
    other = store.create()
    tools = {tool.name: tool for tool in MockTools(session).registered()}
    result = tools["update_recovery_email"].call(
        {"account_id": "account-alex", "new_email": "demo-inbox@example.com"}
    )
    assert isinstance(result, str) and json.loads(result)["updated"] is True
    tools["send_password_reset"].call({"account_id": "account-alex"})
    assert session.verified_accounts == set()
    assert session.accounts["account-alex"].recovery_email == "demo-inbox@example.com"
    assert session.outbox[0].to == "demo-inbox@example.com"
    assert session.outbox[0].reset_url.startswith("https://example.invalid/reset/")
    assert other.accounts["account-alex"].recovery_email == "alex.recovery@example.com"
    assert other.outbox == []


def test_verification_is_bound_to_the_session_and_account(settings: Settings) -> None:
    store = SessionStore(settings.agent.accounts_file, settings.agent.model)
    session = store.create()
    tools = MockTools(session)
    assert json.loads(tools.verify_account("account-alex", "wrong"))["verified"] is False
    assert session.verified_accounts == set()
    assert json.loads(tools.verify_account("account-alex", "246810"))["verified"] is True
    assert session.verified_accounts == {"account-alex"}
    assert json.loads(tools.get_recovery_settings("account-sam"))["verified"] is False
    assert store.create().verified_accounts == set()


def test_account_lookup_masks_email_and_does_not_expose_codes(settings: Settings) -> None:
    session = SessionStore(settings.agent.accounts_file, settings.agent.model).create()
    tools = MockTools(session)
    found = tools.find_account("ALEX@EXAMPLE.COM")
    assert json.loads(found)["account_id"] == "account-alex"
    assert "a***@example.com" in found
    assert "246810" not in found
    assert json.loads(tools.find_account("missing@example.com")) == {"found": False}


@pytest.mark.parametrize(
    "arguments",
    [
        {"account_id": "account-alex", "new_email": "not-an-email"},
        {"account_id": "account-alex"},
        {"account_id": "missing", "new_email": "demo@example.com"},
        {"account_id": "account-alex", "new_email": "demo@example.com", "verified": True},
    ],
)
def test_malformed_tool_inputs_do_not_change_accounts(
    settings: Settings, arguments: dict[str, str | bool]
) -> None:
    session = SessionStore(settings.agent.accounts_file, settings.agent.model).create()
    tool = next(t for t in MockTools(session).registered() if t.name == "update_recovery_email")
    with pytest.raises(ValueError):
        tool.call(arguments)
    assert session.accounts["account-alex"].recovery_email == "alex.recovery@example.com"
