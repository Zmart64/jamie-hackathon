"""Run the single-process demo service using its configured host and port."""

import uvicorn

from support_agent.api import create_app
from support_agent.settings import load_settings


def main() -> None:
    settings = load_settings()
    uvicorn.run(create_app(settings), host=settings.server.host, port=settings.server.port)


if __name__ == "__main__":
    main()
