"""In-memory sessions. Every session gets an independent copy of the fixtures."""

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from threading import Lock

from anthropic.types.beta import BetaMessageParam
from pydantic import TypeAdapter

from support_agent.models import (
    Account,
    AccountSnapshot,
    ChatMessage,
    Conversation,
    MockEmail,
    MockStateSnapshot,
    SessionInfo,
    Turn,
    new_id,
    timestamp,
)


@dataclass
class Session:
    model: str
    accounts: dict[str, Account]
    account_identifier: str | None = None
    id: str = field(default_factory=new_id)
    created_at: datetime = field(default_factory=timestamp)
    history: list[BetaMessageParam] = field(default_factory=list[BetaMessageParam])
    messages: list[ChatMessage] = field(default_factory=list[ChatMessage])
    turns: list[Turn] = field(default_factory=list[Turn])
    verified_accounts: set[str] = field(default_factory=set[str])
    outbox: list[MockEmail] = field(default_factory=list[MockEmail])
    lock: Lock = field(default_factory=Lock, repr=False)

    def info(self) -> SessionInfo:
        return SessionInfo(
            session_id=self.id,
            model=self.model,
            account_identifier=self.account_identifier,
            created_at=self.created_at,
        )

    def conversation(self) -> Conversation:
        return Conversation(**self.info().model_dump(), messages=self.messages, turns=self.turns)

    def snapshot(self) -> MockStateSnapshot:
        return MockStateSnapshot(
            session_id=self.id,
            accounts=[
                AccountSnapshot(
                    id=account.id,
                    email=account.email,
                    recovery_email=account.recovery_email,
                    verified=account.id in self.verified_accounts,
                )
                for account in self.accounts.values()
            ],
            outbox=self.outbox,
        )


class SessionStore:
    def __init__(self, accounts_file: Path, model: str) -> None:
        self._accounts = TypeAdapter(list[Account]).validate_json(
            accounts_file.read_text(encoding="utf-8")
        )
        identifiers = [
            value.casefold()
            for account in self._accounts
            for value in (account.username, account.email)
        ]
        if len({a.id for a in self._accounts}) != len(self._accounts):
            raise ValueError("Demo account IDs must be unique.")
        if len(set(identifiers)) != len(identifiers):
            raise ValueError("Demo account usernames and email identifiers must be unique.")
        self._model = model
        self._sessions: dict[str, Session] = {}
        self._lock = Lock()

    def create(self, identifier: str | None = None) -> Session:
        session = Session(
            model=self._model,
            accounts={account.id: account.model_copy(deep=True) for account in self._accounts},
            account_identifier=identifier,
        )
        if identifier is not None:
            # Login-page input stays user data, never a system instruction or verification.
            session.history.append(
                {
                    "role": "user",
                    "content": "Account identifier entered on the login page (unverified): "
                    + json.dumps(identifier),
                }
            )
        with self._lock:
            self._sessions[session.id] = session
        return session

    def get(self, session_id: str) -> Session | None:
        with self._lock:
            return self._sessions.get(session_id)
