"""Scan current tracked and new nonignored files, without scanning dependencies."""

import shutil
import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory


def snapshot(root: Path, destination: Path) -> None:
    root = root.resolve()
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=root,
        check=True,
        capture_output=True,
    )
    for name in set(result.stdout.decode().split("\0")) - {""}:
        source = root / name
        # Do not follow links to files outside the repository or copy deleted files.
        if source.is_symlink() or not source.resolve().is_relative_to(root) or not source.is_file():
            continue
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    with TemporaryDirectory(prefix="strain-secrets-") as directory:
        snapshot(root, Path(directory))
        return subprocess.run(
            [
                str(root / ".tools/gitleaks"),
                "dir",
                "--redact",
                "--verbose",
                "--no-banner",
                directory,
            ],
            cwd=root,
            check=False,
        ).returncode


if __name__ == "__main__":
    raise SystemExit(main())
