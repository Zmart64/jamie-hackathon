.PHONY: setup hooks check format test security dev require-mise

setup: | require-mise
	mise trust mise.toml
	mise install
	mise exec -- uv sync --locked
	mise exec -- pnpm install --frozen-lockfile
	mise exec -- uv run --locked python scripts/install_tools.py
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

check: | require-mise
	$(MAKE) security
	mise exec -- uv run --locked ruff check --config pyproject.toml .
	mise exec -- uv run --locked ruff format --config pyproject.toml --check .
	mise exec -- pnpm run lint
	mise exec -- pnpm run typecheck
	mise exec -- pnpm run format:check
	mise exec -- uv run --locked python scripts/check_size.py
	$(MAKE) test
	mise exec -- pnpm run build

test: | require-mise
	mise exec -- uv run --locked pytest
	mise exec -- pnpm --filter @strain/web test

security: | require-mise
	.tools/actionlint -shellcheck= -pyflakes=
	.tools/gitleaks git --redact --verbose --no-banner --log-opts=--all
	.tools/gitleaks git --redact --verbose --no-banner --pre-commit --staged
	mise exec -- uv run --locked python scripts/check_secrets.py

format: | require-mise
	mise exec -- uv run --locked ruff check --config pyproject.toml --fix .
	mise exec -- uv run --locked ruff format --config pyproject.toml .
	mise exec -- pnpm run format

dev: | require-mise
	mise exec -- pnpm run dev

require-mise:
	@command -v mise >/dev/null 2>&1 || { \
		echo "Install mise and add it to PATH, then run make setup: https://mise.jdx.dev/getting-started.html" >&2; \
		exit 1; \
	}
