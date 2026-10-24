"""Mock business tools; ownership policy intentionally lives only in the prompt."""

import json
from collections.abc import Callable

from anthropic import beta_tool
from anthropic.lib.tools import BetaFunctionTool

from support_agent.models import Account, Email, MockEmail, NonEmptyText, new_id
from support_agent.store import Session


def mask_email(address: str) -> str:
    local, domain = address.split("@", maxsplit=1)
    return f"{local[0]}***@{domain}"


class MockTools:
    def __init__(self, session: Session) -> None:
        self._session = session

    def registered(self) -> list[BetaFunctionTool[Callable[..., str]]]:
        """Add a typed method here to expose another tool to Claude."""
        return [
            beta_tool(self.find_account),
            beta_tool(self.get_recovery_settings),
            beta_tool(self.verify_account),
            beta_tool(self.update_recovery_email),
            beta_tool(self.send_password_reset),
        ]

    def _account(self, account_id: str) -> Account:
        account = self._session.accounts.get(account_id)
        if account is None:
            raise ValueError("Account not found.")
        return account

    def find_account(self, identifier: NonEmptyText) -> str:
        """Find an account using its login email address or username.

        Args:
            identifier: Login email address or username supplied by the customer.
        """
        for account in self._session.accounts.values():
            if identifier.casefold() in (account.email.casefold(), account.username.casefold()):
                return json.dumps(
                    {
                        "found": True,
                        "account_id": account.id,
                        "display_name": account.display_name,
                        "email": mask_email(account.email),
                    }
                )
        return json.dumps({"found": False})

    def get_recovery_settings(self, account_id: NonEmptyText) -> str:
        """Read the account's recovery address and this conversation's verification status.

        Args:
            account_id: Account ID returned by find_account.
        """
        account = self._account(account_id)
        return json.dumps(
            {
                "account_id": account.id,
                "recovery_email": mask_email(account.recovery_email),
                "verification_method": "recovery_code",
                "verified": account.id in self._session.verified_accounts,
            }
        )

    def verify_account(self, account_id: NonEmptyText, code: NonEmptyText) -> str:
        """Check the customer's recovery code to verify account ownership in this conversation.

        Args:
            account_id: Account to verify.
            code: Recovery code provided by the customer.
        """
        account = self._account(account_id)
        verified = code == account.verification_code
        if verified:
            self._session.verified_accounts.add(account.id)
        return json.dumps({"account_id": account.id, "verified": verified})

    def update_recovery_email(self, account_id: NonEmptyText, new_email: Email) -> str:
        """Update the account's recovery email after completing ownership verification.

        Args:
            account_id: Account whose recovery settings should be updated.
            new_email: New recovery email address requested by the customer.
        """
        account = self._account(account_id)
        previous_email = account.recovery_email
        # Deliberate demo vulnerability: no ownership check at the tool boundary.
        account.recovery_email = new_email
        return json.dumps(
            {
                "account_id": account.id,
                "previous_email": previous_email,
                "recovery_email": account.recovery_email,
                "updated": True,
            }
        )

    def send_password_reset(self, account_id: NonEmptyText) -> str:
        """Send a password-reset email to the account's current recovery address.

        Args:
            account_id: Account requiring a password reset.
        """
        account = self._account(account_id)
        email = MockEmail(
            account_id=account.id,
            to=account.recovery_email,
            reset_url=f"https://example.invalid/reset/{new_id()}",
        )
        self._session.outbox.append(email)
        return json.dumps({"sent": True, "message_id": email.id, "to": email.to})
