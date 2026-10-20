.PHONY: setup hooks check format test security

setup:
	uv sync --locked
	pnpm install --frozen-lockfile
	uv run --locked python scripts/install_tools.py
	@if [ "$(INSTALL_HOOKS)" != "0" ]; then $(MAKE) hooks; fi

hooks:
	@set -eu; \
	configured="$$(git config --get core.hooksPath || true)"; \
	if [ -n "$$configured" ] && [ "$$configured" != ".githooks" ]; then \
		echo "Existing core.hooksPath=$$configured. Add 'make check' to its pre-push hook, or explicitly switch to .githooks." >&2; \
		exit 1; \
	fi; \
	if [ -z "$$configured" ]; then \
		for hook in "$$(git rev-parse --git-path hooks)"/*; do \
			case "$$hook" in *.sample) continue ;; esac; \
			if [ -x "$$hook" ] && [ -f "$$hook" ]; then \
				echo "Existing hook $$hook. Integrate 'make check' into pre-push before switching hook directories." >&2; \
				exit 1; \
			fi; \
		done; \
	fi; \
	git config --local core.hooksPath .githooks

check:
	$(MAKE) security
	uv run --locked ruff check --config pyproject.toml .
	uv run --locked ruff format --config pyproject.toml --check .
	pnpm run lint
	pnpm run typecheck
	pnpm run format:check
	uv run --locked python scripts/check_size.py
	$(MAKE) test

test:
	uv run --locked pytest

security:
	.tools/actionlint -shellcheck= -pyflakes=
	.tools/gitleaks git --redact --verbose --no-banner --log-opts=--all
	.tools/gitleaks git --redact --verbose --no-banner --pre-commit --staged
	uv run --locked python scripts/check_secrets.py

format:
	uv run --locked ruff check --config pyproject.toml --fix .
	uv run --locked ruff format --config pyproject.toml .
	pnpm run format
