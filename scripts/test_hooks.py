"""Verify shared hook installation and that failed checks actually prevent pushes."""

import os
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture
def repository(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    monkeypatch.setenv("GIT_CONFIG_GLOBAL", os.devnull)
    monkeypatch.setenv("GIT_CONFIG_NOSYSTEM", "1")
    root = tmp_path / "repo"
    subprocess.run(["git", "init", "-b", "main", str(root)], check=True, capture_output=True)
    shutil.copytree(ROOT / ".githooks", root / ".githooks")
    return root


def install_hooks(root: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["make", "-f", str(ROOT / "Makefile"), "hooks"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )


def test_hook_installation_is_repeatable(repository: Path) -> None:
    assert install_hooks(repository).returncode == 0
    assert install_hooks(repository).returncode == 0
    result = subprocess.run(
        ["git", "config", "--get", "core.hooksPath"],
        cwd=repository,
        check=True,
        capture_output=True,
        text=True,
    )
    assert result.stdout.strip() == ".githooks"


@pytest.mark.parametrize("custom_directory", [False, True])
def test_setup_preserves_existing_hooks(repository: Path, custom_directory: bool) -> None:
    hooks = repository / ".git" / "hooks"
    if custom_directory:
        hooks = repository / "custom-hooks"
        hooks.mkdir()
        subprocess.run(
            ["git", "config", "core.hooksPath", "custom-hooks"], cwd=repository, check=True
        )
    existing = hooks / "pre-commit"
    existing.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
    existing.chmod(0o755)
    config = repository / ".git" / "config"
    previous = config.read_bytes()
    result = install_hooks(repository)
    assert result.returncode != 0
    assert "Existing" in result.stderr
    assert config.read_bytes() == previous
    assert existing.read_text(encoding="utf-8") == "#!/bin/sh\nexit 0\n"


@pytest.mark.parametrize("check_status", [0, 7])
def test_push_runs_checks_and_stops_on_failure(
    repository: Path, tmp_path: Path, check_status: int
) -> None:
    assert install_hooks(repository).returncode == 0
    subprocess.run(["git", "add", "."], cwd=repository, check=True)
    subprocess.run(
        [
            "git",
            "-c",
            "user.name=Test",
            "-c",
            "user.email=test@example.invalid",
            "commit",
            "-m",
            "test",
        ],
        cwd=repository,
        check=True,
        capture_output=True,
    )
    remote = tmp_path / "remote.git"
    subprocess.run(["git", "init", "--bare", str(remote)], check=True, capture_output=True)
    commands = tmp_path / "commands"
    commands.mkdir()
    make = commands / "make"
    make.write_text(
        '#!/bin/sh\nprintf "%s\\n" "$*" > "$STRAIN_TEST_RECORD"\n'
        'test -z "${GIT_DIR:-}" || exit 99\nexit "$STRAIN_TEST_EXIT"\n',
        encoding="utf-8",
    )
    make.chmod(0o755)
    record = tmp_path / "invocation.txt"
    environment = os.environ | {
        "PATH": f"{commands}{os.pathsep}{os.environ['PATH']}",
        "STRAIN_TEST_RECORD": str(record),
        "STRAIN_TEST_EXIT": str(check_status),
    }
    result = subprocess.run(
        ["git", "push", str(remote), "HEAD:refs/heads/main"],
        cwd=repository,
        env=environment,
        capture_output=True,
        check=False,
    )
    assert (result.returncode == 0) == (check_status == 0)
    assert record.read_text(encoding="utf-8") == "check\n"
    refs = subprocess.run(
        ["git", "ls-remote", str(remote), "refs/heads/main"],
        cwd=repository,
        check=True,
        capture_output=True,
    )
    assert bool(refs.stdout) == (check_status == 0)
