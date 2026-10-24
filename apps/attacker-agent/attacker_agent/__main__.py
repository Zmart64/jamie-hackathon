"""Run the local attacker API alongside the existing support API."""

import uvicorn

from attacker_agent.api import create_app
from attacker_agent.settings import load_settings


def main() -> None:
    settings = load_settings()
    uvicorn.run(create_app(settings), host=settings.host, port=settings.port)


if __name__ == "__main__":
    main()
