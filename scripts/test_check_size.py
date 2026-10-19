"""Behavioral tests for the repository's custom quality gate."""

import subprocess
from pathlib import Path

from check_size import count_lines, violations


def git(root: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=root, check=True, capture_output=True)


def test_counts_comments_but_not_blank_lines(tmp_path: Path) -> None:
    source = tmp_path / "example.py"
    source.write_text('# comment\n\n  \n"""docstring"""\nx = 1\n', encoding="utf-8")
    assert count_lines(source) == 3


def test_boundary_and_discovery(tmp_path: Path) -> None:
    git(tmp_path, "init")
    source = tmp_path / "new package" / "example.ts"
    source.parent.mkdir()
    source.write_text("// comment\n" * 500, encoding="utf-8")
    assert violations(tmp_path) == []
    source.write_text("// comment\n" * 501, encoding="utf-8")
    assert violations(tmp_path) == ["new package/example.ts: 501 nonblank lines; maximum is 500"]


def test_ignored_untracked_but_not_tracked_files(tmp_path: Path) -> None:
    git(tmp_path, "init")
    source = tmp_path / "example.py"
    source.write_text("# comment\n" * 501, encoding="utf-8")
    git(tmp_path, "add", "example.py")
    (tmp_path / ".gitignore").write_text("*.py\n", encoding="utf-8")
    (tmp_path / "ignored.py").write_text("# comment\n" * 501, encoding="utf-8")
    assert violations(tmp_path) == ["example.py: 501 nonblank lines; maximum is 500"]
