"""Exercise onboarding and command selection without a developer's shell setup."""

import json
import shutil
import subprocess
import tomllib
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


def executable(path: Path, source: str) -> None:
    path.write_text("#!/bin/sh\nset -eu\n" + source, encoding="utf-8")
    path.chmod(0o755)


@pytest.fixture
def checkout(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "checkout with spaces"
    root.mkdir()
    shutil.copy(ROOT / "Makefile", root)
    commands = root / "commands"
    commands.mkdir()
    managed = root / "managed"
    managed.mkdir()
    # Only make and our fake mise are on PATH; no shell activation or host tools.
    make = shutil.which("make")
    assert make is not None
    (commands / "make").symlink_to(make)
    monkeypatch.setenv("PATH", str(commands))
    monkeypatch.delenv("MAKEFLAGS", raising=False)
    monkeypatch.setenv("STRAIN_TEST_RECORD", str(root / "commands.log"))
    monkeypatch.setenv("STRAIN_TEST_MANAGED", str(managed))
    executable(
        commands / "mise",
        'printf "mise %s\\n" "$*" >> "$STRAIN_TEST_RECORD"\n'
        'case "$1" in\n'
        "  trust) exit 0 ;;\n"
        '  install) exit "${STRAIN_TEST_INSTALL_STATUS:-0}" ;;\n'
        '  exec) shift; test "$1" = --; shift\n'
        '    export PATH="$STRAIN_TEST_MANAGED:$PATH"; exec "$@" ;;\n'
        "  *) exit 98 ;;\n"
        "esac\n",
    )
    for name in ("uv", "pnpm", "node"):
        executable(
            managed / name,
            'tool="${0##*/}"\n'
            'printf "%s %s\\n" "$tool" "$*" >> "$STRAIN_TEST_RECORD"\n'
            'if [ "$tool $*" = "${STRAIN_TEST_FAIL_COMMAND:-}" ]; then exit 7; fi\n'
            'if [ "$tool" = pnpm ]; then node --version; fi\n',
        )
    tools = root / ".tools"
    tools.mkdir()
    for name in ("actionlint", "gitleaks"):
        executable(tools / name, "exit 0\n")
    return root


def run_make(root: Path, target: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["make", target, "INSTALL_HOOKS=0"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )


@pytest.mark.parametrize(
    "target",
    [
        "setup",
        "check",
        "test",
        "dev",
        "format",
        "security",
        "dev-demo",
        "support-agent",
        "redteam-agent",
        "redteam-agent-check",
        "redteam-agent-rehearsal",
    ],
)
def test_missing_mise_explains_how_to_start(checkout: Path, target: str) -> None:
    (checkout / "commands" / "mise").unlink()
    result = run_make(checkout, target)
    assert result.returncode != 0
    assert "Install mise and add it to PATH" in result.stderr
    assert "make setup" in result.stderr
    assert not (checkout / "commands.log").exists()


@pytest.mark.parametrize("host_tools", [False, True])
@pytest.mark.parametrize(
    ("target", "expected"),
    [
        ("setup", "pnpm install --frozen-lockfile"),
        ("check", "pnpm run typecheck"),
        ("test", "uv run --locked pytest"),
        ("dev", "pnpm run dev"),
        ("dev-demo", "pnpm run dev:demo"),
        ("support-agent", "uv run --locked support-agent"),
        ("redteam-agent", "pnpm --filter @strain/redteam-agent start -- --mode browser"),
        (
            "redteam-agent-check",
            "pnpm --filter @strain/redteam-agent start -- --mode browser --check",
        ),
        (
            "redteam-agent-rehearsal",
            "pnpm --filter @strain/redteam-agent start -- --mode rehearsal",
        ),
        ("format", "pnpm run format"),
        ("security", "uv run --locked python scripts/check_secrets.py"),
    ],
)
def test_commands_use_managed_tools(
    checkout: Path, target: str, expected: str, host_tools: bool
) -> None:
    if host_tools:
        for name in ("uv", "pnpm", "node"):
            executable(checkout / "commands" / name, 'echo "Wrong host version" >&2; exit 99\n')
    result = run_make(checkout, target)
    assert result.returncode == 0, result.stdout + result.stderr
    calls = (checkout / "commands.log").read_text(encoding="utf-8").splitlines()
    assert expected in calls
    if expected.startswith("pnpm"):
        assert "node --version" in calls


def test_setup_installs_before_using_tools_and_can_be_repeated(checkout: Path) -> None:
    for _ in range(2):
        assert run_make(checkout, "setup").returncode == 0
    calls = (checkout / "commands.log").read_text(encoding="utf-8").splitlines()
    assert calls.count("mise install") == 2
    assert calls.index("mise trust mise.toml") < calls.index("mise install")
    assert calls.index("mise install") < calls.index("uv sync --locked")
    assert calls.count("uv run --locked python scripts/install_tools.py") == 2


def test_failed_tool_install_stops_setup(checkout: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("STRAIN_TEST_INSTALL_STATUS", "7")
    result = run_make(checkout, "setup")
    assert result.returncode != 0
    calls = (checkout / "commands.log").read_text(encoding="utf-8").splitlines()
    assert calls == ["mise trust mise.toml", "mise install"]


@pytest.mark.parametrize(
    ("target", "failure"),
    [
        ("setup", "uv sync --locked"),
        ("check", "pnpm run lint"),
        ("test", "uv run --locked pytest"),
        ("dev", "pnpm run dev"),
        ("dev-demo", "pnpm run dev:demo"),
        ("support-agent", "uv run --locked support-agent"),
        ("redteam-agent", "pnpm --filter @strain/redteam-agent start -- --mode browser"),
    ],
)
def test_command_failures_propagate(
    checkout: Path, monkeypatch: pytest.MonkeyPatch, target: str, failure: str
) -> None:
    monkeypatch.setenv("STRAIN_TEST_FAIL_COMMAND", failure)
    result = run_make(checkout, target)
    assert result.returncode != 0
    calls = (checkout / "commands.log").read_text(encoding="utf-8").splitlines()
    assert calls[-1] == failure


def test_mise_versions_match_other_manifests() -> None:
    configuration = tomllib.loads((ROOT / "mise.toml").read_text(encoding="utf-8"))
    tools = configuration["tools"]
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    assert tools["node"] == (ROOT / ".node-version").read_text(encoding="utf-8").strip()
    assert f"pnpm@{tools['pnpm']}" == package["packageManager"]
