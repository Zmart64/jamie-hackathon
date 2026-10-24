"""Record the real support frontend with matching viewport and video dimensions."""

import asyncio
import json
from pathlib import Path

import httpx
from playwright.async_api import Error as BrowserError
from playwright.async_api import ViewportSize, async_playwright
from pydantic import BaseModel, Field, HttpUrl

from attacker_agent.browser_display import follow_browser
from attacker_agent.browser_target import BrowserTarget
from attacker_agent.clients import ModelClient
from attacker_agent.events import RunRecord
from attacker_agent.runner import Runner
from attacker_agent.settings import Settings


class BrowserOptions(BaseModel):
    frontend_url: HttpUrl = HttpUrl("http://127.0.0.1:5174")
    headless: bool = False
    typing_delay_ms: int = Field(default=12, ge=0, le=100)
    hold_seconds: float = Field(default=15, ge=0, le=300)
    show_notebook_overlay: bool = False


async def run_browser(
    record: RunRecord, client: httpx.AsyncClient, settings: Settings, options: BrowserOptions
) -> None:
    directory = record.log_dir / record.view.id
    directory.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as playwright:
        try:
            browser = await playwright.chromium.launch(headless=options.headless)
        except BrowserError:
            record.emit(
                "error",
                {
                    "code": "browser_launch_failed",
                    "message": "Could not launch Chromium. Run: uv run playwright install chromium",
                },
            )
            record.finish("failed", "browser_launch_failed")
            return
        # Match the supplied demo reference's proportions and chat-panel size.
        # Keep video/viewport sizes equal; larger video frames add grey padding.
        capture_size: ViewportSize = {"width": 1220, "height": 780}
        context = await browser.new_context(
            viewport=capture_size,
            record_video_dir=str(directory / "video"),
            record_video_size=capture_size,
        )
        await context.tracing.start(screenshots=True, snapshots=True, sources=True)
        page = await context.new_page()
        page.set_default_timeout(settings.request_timeout_seconds * 1000)
        await page.bring_to_front()
        target = BrowserTarget(
            page,
            client,
            str(settings.target_base_url),
            str(options.frontend_url),
            record,
            options.typing_delay_ms,
        )
        await target.install()
        record.emit("browser_started", {"frontend_url": str(options.frontend_url)})
        display = (
            asyncio.create_task(follow_browser(record, page))
            if options.show_notebook_overlay
            else None
        )
        try:
            await Runner(record, ModelClient(client, settings), target, settings).run()
            if display is not None:
                await display
            await page.screenshot(path=str(directory / "browser-final.png"), full_page=True)
            if options.hold_seconds:
                await asyncio.sleep(options.hold_seconds)
        finally:
            if display is not None:
                display.cancel()
                await asyncio.gather(display, return_exceptions=True)
            await context.tracing.stop(path=directory / "browser-trace.zip")
            video = page.video
            await context.close()
            if video:
                await video.save_as(directory / "browser.webm")
            await browser.close()
        manifest = {
            "run_id": record.view.id,
            "frontend_url": str(options.frontend_url),
            "session_bindings": target.bindings,
            "video": "browser.webm",
            "trace": "browser-trace.zip",
            "screenshot": "browser-final.png",
            "show_notebook_overlay": options.show_notebook_overlay,
            "headless": options.headless,
            "viewport": capture_size,
            "record_video_size": capture_size,
        }
        (directory / "browser.json").write_text(json.dumps(manifest, indent=2) + "\n")
        _print_artifacts(directory)


def _print_artifacts(directory: Path) -> None:
    print(f"Browser recording: {directory / 'browser.webm'}", flush=True)
    print(f"Playwright trace: {directory / 'browser-trace.zip'}", flush=True)
