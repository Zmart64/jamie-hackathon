"""Install the two standalone quality tools from checksum-pinned upstream releases."""

import hashlib
import io
import json
import platform
import tarfile
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import TypedDict, cast
from urllib.request import urlopen


class Tool(TypedDict):
    repository: str
    version: str
    archives: dict[str, str]


def install_archive(data: bytes, checksum: str, destination: Path) -> None:
    if hashlib.sha256(data).hexdigest() != checksum:
        raise ValueError(f"Checksum mismatch for {destination.name}")
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        member = archive.getmember(destination.name)
        if not member.isfile():
            raise ValueError(f"Expected a regular binary for {destination.name}")
        binary = archive.extractfile(member)
        if binary is None:
            raise ValueError(f"Missing binary for {destination.name}")
        # Read only the named binary; never extract archive paths or symlinks.
        with binary, TemporaryDirectory(dir=destination.parent) as directory:
            temporary = Path(directory) / destination.name
            temporary.write_bytes(binary.read())
            temporary.chmod(0o755)
            temporary.replace(destination)


def install(name: str, tool: Tool, directory: Path) -> None:
    machine = platform.machine().lower()
    architecture = {"aarch64": "arm64", "x86_64": "amd64"}.get(machine, machine)
    if name == "gitleaks" and architecture == "amd64":
        architecture = "x64"
    target = f"{platform.system().lower()}_{architecture}"
    if target not in tool["archives"]:
        raise ValueError(f"Unsupported platform: {target}; use macOS or Linux (ARM64/x64)")
    checksum = tool["archives"][target]
    filename = f"{name}_{tool['version']}_{target}.tar.gz"
    cached = directory / filename
    if not cached.exists():
        url = f"https://github.com/{tool['repository']}/releases/download/v{tool['version']}/{filename}"
        with urlopen(url, timeout=60) as response:
            data = response.read()
        # Verify before caching or installing the download.
        if hashlib.sha256(data).hexdigest() != checksum:
            raise ValueError(f"Checksum mismatch for {filename}")
        cached.write_bytes(data)
    install_archive(cached.read_bytes(), checksum, directory / name)
    print(f"Installed {name} {tool['version']}")


def main() -> None:
    manifest = Path(__file__).with_name("tools.json")
    tools = cast(dict[str, Tool], json.loads(manifest.read_text(encoding="utf-8")))
    directory = manifest.parent.parent / ".tools"
    directory.mkdir(exist_ok=True)
    for name, tool in tools.items():
        install(name, tool, directory)


if __name__ == "__main__":
    main()
