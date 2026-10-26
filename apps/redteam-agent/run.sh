#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

MODE="browser"
case "${1:-}" in
  browser|rehearsal)
    MODE="$1"
    shift
    ;;
esac

exec pnpm exec tsx src/main.ts --mode "$MODE" "$@"
