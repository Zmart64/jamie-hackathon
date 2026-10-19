.PHONY: setup check format test

setup:
	uv sync --locked
	pnpm install --frozen-lockfile

check:
	uv run --locked ruff check --config pyproject.toml .
	uv run --locked ruff format --config pyproject.toml --check .
	pnpm run lint
	pnpm run typecheck
	pnpm run format:check
	uv run --locked python scripts/check_size.py
	$(MAKE) test

test:
	uv run --locked pytest

format:
	uv run --locked ruff check --config pyproject.toml --fix .
	uv run --locked ruff format --config pyproject.toml .
	pnpm run format
