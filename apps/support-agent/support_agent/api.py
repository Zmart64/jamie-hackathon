"""Small HTTP boundary for a login-page chat widget and demo trace viewer."""

from collections.abc import AsyncGenerator, Generator
from contextlib import asynccontextmanager, contextmanager
from typing import Annotated

from anthropic import Anthropic
from fastapi import Body, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from support_agent.agent import SupportAgent
from support_agent.api_errors import install_error_handlers
from support_agent.models import (
    Conversation,
    CreateSessionRequest,
    ErrorResponse,
    HealthResponse,
    MockStateSnapshot,
    SendMessageRequest,
    SessionInfo,
    Turn,
)
from support_agent.settings import Settings, load_settings
from support_agent.store import Session, SessionStore


@contextmanager
def _locked_session(store: SessionStore, session_id: str) -> Generator[Session]:
    session = store.get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found. Start a new session.")
    if not session.lock.acquire(blocking=False):
        raise HTTPException(
            status_code=409, detail="This session is processing a message. Try again."
        )
    try:
        yield session
    finally:
        session.lock.release()


def _build_client(settings: Settings) -> Anthropic | None:
    if settings.api_key is None:
        return None
    return Anthropic(
        api_key=settings.api_key.get_secret_value(),
        timeout=settings.agent.request_timeout_seconds,
        max_retries=0,
    )


def create_app(settings: Settings | None = None, client: Anthropic | None = None) -> FastAPI:
    """Build an isolated app; tests can inject an SDK client with a mock HTTP transport."""
    settings = settings or load_settings()
    prompt = settings.agent.system_prompt.read_text(encoding="utf-8").strip()
    if not prompt:
        raise ValueError("The system prompt must not be empty.")
    store = SessionStore(settings.agent.accounts_file, settings.agent.model)
    owns_client = client is None
    client = client or _build_client(settings)
    agent = SupportAgent(settings.agent, prompt, client)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
        yield
        if owns_client and client is not None:
            client.close()

    app = FastAPI(
        title="Carbon Zero Support Agent",
        description="Account-recovery conversations with messages and action receipts.",
        version="0.1.0",
        lifespan=lifespan,
        responses={404: {"model": ErrorResponse}, 405: {"model": ErrorResponse}},
    )
    install_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.server.allowed_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.get("/health", operation_id="getHealth")
    def health() -> HealthResponse:
        return HealthResponse(model=settings.agent.model, configured=client is not None)

    @app.post(
        "/sessions",
        status_code=201,
        operation_id="createSession",
        responses={422: {"model": ErrorResponse}},
    )
    def create_session(
        request: Annotated[CreateSessionRequest | None, Body()] = None,
    ) -> SessionInfo:
        return store.create(request.account_identifier if request else None).info()

    @app.post(
        "/sessions/{session_id}/messages",
        operation_id="sendMessage",
        responses={
            409: {"model": ErrorResponse},
            422: {"model": ErrorResponse},
            502: {"model": Turn},
            503: {"model": Turn},
        },
    )
    def send_message(session_id: str, request: SendMessageRequest, response: Response) -> Turn:
        with _locked_session(store, session_id) as session:
            turn = agent.respond(session, request.message)
        if turn.error is not None:
            response.status_code = 503 if turn.error.code == "missing_api_key" else 502
        return turn

    @app.get(
        "/sessions/{session_id}/messages",
        operation_id="getConversation",
        responses={409: {"model": ErrorResponse}},
    )
    def get_messages(session_id: str) -> Conversation:
        with _locked_session(store, session_id) as session:
            return session.conversation().model_copy(deep=True)

    @app.get(
        "/sessions/{session_id}/mock-state",
        tags=["Demo inspection"],
        operation_id="getMockState",
        responses={409: {"model": ErrorResponse}},
    )
    def get_mock_state(session_id: str) -> MockStateSnapshot:
        """Inspect actual side effects. This endpoint is for the demo viewer, not a Claude tool."""
        with _locked_session(store, session_id) as session:
            return session.snapshot().model_copy(deep=True)

    return app
