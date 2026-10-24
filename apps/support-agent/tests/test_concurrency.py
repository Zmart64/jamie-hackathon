from concurrent.futures import ThreadPoolExecutor
from threading import Event

import httpx2
from anthropic import Anthropic
from fastapi.testclient import TestClient
from support_agent.api import create_app
from support_agent.models import ErrorResponse, SessionInfo
from support_agent.settings import Settings

from .helpers import reply


def test_overlapping_turn_is_rejected_and_lock_is_released(settings: Settings) -> None:
    entered = Event()
    release = Event()

    def handle(_request: httpx2.Request) -> httpx2.Response:
        entered.set()
        assert release.wait(timeout=5)
        return reply("How can I help?")

    with (
        Anthropic(
            api_key="test-only-placeholder",
            max_retries=0,
            http_client=httpx2.Client(transport=httpx2.MockTransport(handle)),
        ) as client,
        TestClient(create_app(settings, client)) as api,
        ThreadPoolExecutor() as executor,
    ):
        session_id = SessionInfo.model_validate(api.post("/sessions").json()).session_id
        endpoint = f"/sessions/{session_id}/messages"
        first = executor.submit(api.post, endpoint, json={"message": "First"})
        try:
            assert entered.wait(timeout=5)
            overlapping = api.post(endpoint, json={"message": "Overlapping"})
            assert overlapping.status_code == 409
            assert ErrorResponse.model_validate(overlapping.json()).error.code == "session_busy"
        finally:
            release.set()
        assert first.result(timeout=5).status_code == 200
        assert api.post(endpoint, json={"message": "Next"}).status_code == 200
