"""Exercise checksum failures, safe extraction, and secret-scan discovery."""

import hashlib
import io
import subprocess
import tarfile
from pathlib import Path

import pytest
from check_secrets import snapshot
from install_tools import install_archive


def make_archive(*, symlink: bool = False) -> bytes:
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:gz") as archive:
        binary = tarfile.TarInfo("scanner")
        if symlink:
            binary.type = tarfile.SYMTYPE
            binary.linkname = "../outside"
            archive.addfile(binary)
        else:
            binary.size = 4
            archive.addfile(binary, io.BytesIO(b"tool"))
        unrelated = tarfile.TarInfo("../outside")
        unrelated.size = 4
        archive.addfile(unrelated, io.BytesIO(b"oops"))
    return output.getvalue()


def test_installs_only_verified_binary(tmp_path: Path) -> None:
    data = make_archive()
    destination = tmp_path / "bin" / "scanner"
    destination.parent.mkdir()
    install_archive(data, hashlib.sha256(data).hexdigest(), destination)
    assert destination.read_bytes() == b"tool"
    assert destination.stat().st_mode & 0o777 == 0o755
    assert not (tmp_path / "outside").exists()


def test_bad_checksum_preserves_existing_binary(tmp_path: Path) -> None:
    destination = tmp_path / "scanner"
    destination.write_bytes(b"original")
    with pytest.raises(ValueError, match="Checksum mismatch"):
        install_archive(make_archive(), "0" * 64, destination)
    assert destination.read_bytes() == b"original"


def test_rejects_link_in_place_of_binary(tmp_path: Path) -> None:
    data = make_archive(symlink=True)
    with pytest.raises(ValueError, match="regular binary"):
        install_archive(data, hashlib.sha256(data).hexdigest(), tmp_path / "scanner")
    assert not (tmp_path / "scanner").exists()


def test_snapshot_includes_tracked_ignored_and_new_files(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    subprocess.run(["git", "init", str(root)], check=True, capture_output=True)
    (root / "tracked.env").write_text("tracked", encoding="utf-8")
    (root / "deleted.py").touch()
    subprocess.run(["git", "add", "."], cwd=root, check=True, capture_output=True)
    (root / "deleted.py").unlink()
    (root / ".gitignore").write_text("*.env\n", encoding="utf-8")
    (root / "ignored.env").write_text("ignored", encoding="utf-8")
    (root / "new file.py").write_text("new", encoding="utf-8")
    (root / "link.py").symlink_to(root / "ignored.env")
    destination = tmp_path / "snapshot"
    snapshot(root, destination)
    assert sorted(path.name for path in destination.iterdir()) == [
        ".gitignore",
        "new file.py",
        "tracked.env",
    ]


def test_scanner_rejects_secret_and_redacts_output(tmp_path: Path) -> None:
    # Deliberately synthetic; assemble at runtime so the fixture is not a finding.
    secret = "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8"
    (tmp_path / "credential.txt").write_text(secret, encoding="utf-8")
    scanner = Path(__file__).resolve().parent.parent / ".tools/gitleaks"
    result = subprocess.run(
        [str(scanner), "dir", "--redact", "--verbose", "--no-banner", str(tmp_path)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1
    assert "leaks found" in result.stderr
    assert secret not in result.stdout + result.stderr


def test_snapshot_does_not_follow_parent_link_outside_repo(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    subprocess.run(["git", "init", str(root)], check=True, capture_output=True)
    folder = root / "folder"
    folder.mkdir()
    source = folder / "file.txt"
    source.touch()
    subprocess.run(["git", "add", "."], cwd=root, check=True, capture_output=True)
    source.unlink()
    folder.rmdir()
    (tmp_path / "file.txt").write_text("outside repository", encoding="utf-8")
    folder.symlink_to(tmp_path, target_is_directory=True)
    destination = tmp_path / "snapshot"
    destination.mkdir()
    snapshot(root, destination)
    assert list(destination.iterdir()) == []


def test_scanner_finds_staged_secret_after_working_file_is_cleaned(tmp_path: Path) -> None:
    subprocess.run(["git", "init", str(tmp_path)], check=True, capture_output=True)
    source = tmp_path / "credential.txt"
    source.write_text("ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8", encoding="utf-8")
    subprocess.run(["git", "add", "."], cwd=tmp_path, check=True, capture_output=True)
    source.write_text("clean working file", encoding="utf-8")
    scanner = Path(__file__).resolve().parent.parent / ".tools/gitleaks"
    result = subprocess.run(
        [str(scanner), "git", "--redact", "--no-banner", "--pre-commit", "--staged"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 1
    assert "leaks found" in result.stderr
