"""Limit source files to 500 nonblank lines, including comments and docstrings."""

import subprocess
from pathlib import Path

MAX_LINES = 500
SOURCE_SUFFIXES = {".py", ".pyi", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"}


def count_lines(path: Path) -> int:
    return sum(bool(line.strip()) for line in path.read_text(encoding="utf-8").splitlines())


def violations(root: Path) -> list[str]:
    # Git supplies tracked AND new, nonignored files. A tracked file remains checked
    # even if somebody adds it to .gitignore later.
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=root,
        check=True,
        capture_output=True,
    )
    errors: list[str] = []
    for name in sorted(set(result.stdout.decode().split("\0")) - {""}):
        path = root / name
        if path.suffix not in SOURCE_SUFFIXES or not path.exists():
            continue
        lines = count_lines(path)
        if lines > MAX_LINES:
            errors.append(f"{name}: {lines} nonblank lines; maximum is {MAX_LINES}")
    return errors


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    errors = violations(root)
    for error in errors:
        print(error)
    if not errors:
        print(f"Source size check passed (maximum {MAX_LINES} nonblank lines).")
    return int(bool(errors))


if __name__ == "__main__":
    raise SystemExit(main())
