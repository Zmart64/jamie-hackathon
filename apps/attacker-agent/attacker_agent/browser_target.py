"""Drive Sprout's actual composer; never replace chat requests or responses."""

import re
from uuid import uuid4

import httpx
from playwright.async_api import Error as BrowserError
from playwright.async_api import Page, Response, Route, expect
from pydantic import ValidationError

from attacker_agent.clients import MockState, RunFailure, TargetClient, TargetTurn
from attacker_agent.events import RunRecord

MESSAGE_PATH = re.compile(r"/sessions/([0-9a-f-]{36})/messages$")


def message_session(url: str) -> str | None:
    match = MESSAGE_PATH.search(httpx.URL(url).path)
    return match.group(1) if match else None


def is_message_response(response: Response) -> bool:
    return response.request.method == "POST" and message_session(response.url) is not None


class BrowserTarget(TargetClient):
    """Logical conversation handles bind to real sessions on the first UI submit."""

    def __init__(
        self,
        page: Page,
        client: httpx.AsyncClient,
        base_url: str,
        frontend_url: str,
        record: RunRecord,
        typing_delay_ms: int = 12,
    ) -> None:
        super().__init__(client, base_url)
        self.page = page
        self.frontend_url = frontend_url
        self.record = record
        self.typing_delay_ms = typing_delay_ms
        self.max_message_chars = 2000
        self.single_line_messages = True
        self.active_handle = ""
        self.bindings: dict[str, str] = {}

    async def install(self) -> None:
        await self.page.route("**/api/support/sessions/*/messages", self._before_request)

    async def _before_request(self, route: Route) -> None:
        real_id = message_session(route.request.url)
        if route.request.method == "POST" and real_id and self.active_handle:
            if self.active_handle not in self.bindings:
                self.bindings[self.active_handle] = real_id
                self.record.emit(
                    "browser_session_bound",
                    {"session_id": self.active_handle, "target_session_id": real_id},
                )
            if self.bindings[self.active_handle] != real_id:
                await route.abort()
                raise RunFailure("browser_session_mismatch", "The UI changed support sessions.")
            self.before_send_state = await super().inspect(real_id)
        # Only observe/pause; the original browser request reaches the real backend.
        await route.continue_()

    async def new_session(self, identifier: str | None) -> str:
        del identifier  # Public identity is supplied in the agent's chat, as in the UI.
        try:
            if not self.active_handle:
                await self.page.goto(self.frontend_url, wait_until="domcontentloaded")
                await self.page.get_by_role("button", name="Open Sprout", exact=True).click()
            else:
                restart = self.page.get_by_role("button", name="Start new conversation", exact=True)
                if await restart.count():
                    await restart.click()
            composer = self.page.get_by_role("textbox", name="Message Sprout", exact=True)
            await expect(composer).to_be_editable()
            limit = await composer.get_attribute("maxlength")
            if limit:
                self.max_message_chars = int(limit)
        except (BrowserError, AssertionError, ValueError) as error:
            raise RunFailure(
                "browser_ui_unavailable", "Could not open the real Sprout chat composer."
            ) from error
        self.active_handle = str(uuid4())
        self.before_send_state = None
        return self.active_handle

    async def send(self, session_id: str, message: str) -> TargetTurn:
        if session_id != self.active_handle:
            raise RunFailure(
                "browser_session_mismatch", "The requested conversation is not active."
            )
        if len(message) > self.max_message_chars:
            raise RunFailure(
                "browser_message_too_long",
                f"The message exceeds the composer's {self.max_message_chars}-character limit.",
            )
        if "\n" in message or "\r" in message:
            raise RunFailure("browser_multiline_message", "The real composer accepts one line.")
        self.before_send_state = None
        try:
            composer = self.page.get_by_role("textbox", name="Message Sprout", exact=True)
            await expect(composer).to_be_editable()
            await composer.fill("")
            await composer.press_sequentially(message, delay=self.typing_delay_ms)
            if await composer.input_value() != message:
                raise RunFailure(
                    "browser_composer_mismatch", "The typed text differs from the planned message."
                )
            async with self.page.expect_response(is_message_response) as pending:
                await self.page.get_by_role("button", name="Send message", exact=True).click()
            response = await pending.value
            turn = TargetTurn.model_validate(await response.json())
        except (BrowserError, ValidationError, ValueError) as error:
            raise RunFailure(
                "browser_send_failed",
                "The browser could not confirm this turn. It will not resend it automatically.",
            ) from error
        return await self._read_reply(turn)

    async def _read_reply(self, turn: TargetTurn) -> TargetTurn:
        if turn.status != "completed" or not turn.reply:
            return turn
        rendered = (
            self.page.get_by_role("log", name="Conversation with Sprout")
            .locator(".chat-message-assistant p")
            .last
        )
        try:
            await expect(rendered).to_have_text(turn.reply)
            reply = await rendered.inner_text()
            await expect(
                self.page.get_by_role("textbox", name="Message Sprout", exact=True)
            ).to_be_editable()
        except (BrowserError, AssertionError):
            self.record.emit(
                "browser_ui_error",
                {"message": "The backend returned, but the real reply did not render in chat."},
            )
            # Preserve executed receipts for the observer even when UI delivery failed.
            return turn.model_copy(update={"status": "failed", "reply": None})
        self.record.emit("browser_reply_observed", {"source": "rendered_chat"})
        return turn.model_copy(update={"reply": reply})

    async def inspect(self, session_id: str) -> MockState | None:
        real_id = self.bindings.get(session_id)
        return await super().inspect(real_id) if real_id else None
