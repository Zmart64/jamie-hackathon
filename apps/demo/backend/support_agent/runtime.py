"""Identify the source, prompt and agent configuration loaded by this process."""

from hashlib import sha256

from support_agent.settings import PACKAGE_DIR, Settings


def source_fingerprint(settings: Settings, prompt: str) -> str:
    """Capture once at startup so edits on disk cannot masquerade as loaded code."""
    digest = sha256()
    for path in sorted(PACKAGE_DIR.glob("*.py")):
        digest.update(path.name.encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    digest.update(settings.agent.model_dump_json().encode())
    digest.update(prompt.encode())
    digest.update(settings.agent.accounts_file.read_bytes())
    return digest.hexdigest()
