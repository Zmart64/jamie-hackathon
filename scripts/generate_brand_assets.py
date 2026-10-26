"""Generate Strain's mark, lockups and icons from one geometry definition.

Usage: uv run python scripts/generate_brand_assets.py [--rasters]

SVGs are written to apps/platform/public/brand. With --rasters, the PNG and ICO
files are rendered too; that needs rsvg-convert and ImageMagick (magick).
"""

import argparse
import math
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT / "apps" / "platform" / "public"
BRAND_DIR = PUBLIC_DIR / "brand"
OUTLINES = ROOT / "brand" / "wordmark-outlines.svg"

INK = "#0B0B0F"
BONE = "#EDE8DC"
# Photoelastic fringes: how clear material shows stress under polarized light.
PHOTOELASTIC = (
    (0.0, "#7C6CFF"),
    (0.3, "#3FD0E0"),
    (0.55, "#E9F46A"),
    (0.8, "#FF8FB1"),
    (1.0, "#9B7BFF"),
)
SKEW_DEGREES = 14
# Top cap, core and bottom cap before shearing, on a 64-unit grid. The set is
# point-symmetric about (32, 32), so the S reads the same rotated 180 degrees.
SLABS = ((26, 11, 26, 9), (12, 25, 40, 14), (12, 44, 26, 9))
SLAB_RADIUS = 2.5
TILE_RADIUS = 14
TILE_MARK_SCALE = 0.86
MASKABLE_MARK_SCALE = 0.62
LOCKUP_GAP = 240
CAP_TOP, CAP_HEIGHT, OUTLINES_WIDTH = 36, 698, 3536


def mark_bounds() -> tuple[float, float, float, float]:
    """Return the sheared mark's x, y, width and height."""
    shift = math.tan(math.radians(SKEW_DEGREES)) * (32 - min(y for _, y, _, _ in SLABS))
    left = min(x for x, *_ in SLABS) - shift
    top = min(y for _, y, _, _ in SLABS)
    bottom = max(y + h for _, y, _, h in SLABS)
    return left, top, 64 - 2 * left, bottom - top


def slabs(cap: str, core: str) -> str:
    """Draw the three sheared slabs; the core may use a gradient fill."""
    fills = (cap, core, cap)
    rects = "".join(
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{SLAB_RADIUS}" fill="{fill}"/>'
        for (x, y, w, h), fill in zip(SLABS, fills, strict=True)
    )
    return f'<g transform="translate(32 32) skewX(-{SKEW_DEGREES}) translate(-32 -32)">{rects}</g>'


def photoelastic_gradient(gradient_id: str = "core") -> str:
    """Return the core-slab gradient running along the slip direction."""
    stops = "".join(
        f'<stop offset="{offset}" stop-color="{color}"/>' for offset, color in PHOTOELASTIC
    )
    return (
        f'<defs><linearGradient id="{gradient_id}" x1="0" y1="0" x2="1" y2="0">'
        f"{stops}</linearGradient></defs>"
    )


def _doc(viewbox: str, body: str, title: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}" role="img" '
        f'aria-labelledby="title">\n<title id="title">{title}</title>\n{body}\n</svg>\n'
    )


def _tile(background: str, cap: str, core: str, radius: int, scale: float) -> str:
    group = (
        f'<g transform="translate(32 32) scale({scale}) translate(-32 -32)">{slabs(cap, core)}</g>'
    )
    return f'<rect width="64" height="64" rx="{radius}" fill="{background}"/>{group}'


def _lockup(fill: str, outlines: str) -> str:
    glyphs = re.findall(r'<path fill="#[0-9A-Fa-f]+" (transform="[^"]+" d="[^"]+")/>', outlines)
    if len(glyphs) != 6:
        raise ValueError(f"expected 6 STRAIN glyph outlines, found {len(glyphs)}")
    left, top, width, height = mark_bounds()
    scale = CAP_HEIGHT / height
    mark_width = width * scale
    mark = (
        f'<g transform="translate({-left * scale:.2f} {CAP_TOP - top * scale:.2f}) '
        f'scale({scale:.4f})">{slabs(fill, "url(#core)")}</g>'
    )
    text = "".join(f'<path fill="{fill}" {glyph}/>' for glyph in glyphs)
    body = (
        photoelastic_gradient()
        + mark
        + f'<g transform="translate({mark_width + LOCKUP_GAP:.2f} 0)">{text}</g>'
    )
    return _doc(f"0 0 {OUTLINES_WIDTH + mark_width + LOCKUP_GAP:.0f} 770", body, "STRAIN")


def build_svgs(outlines: str) -> dict[str, str]:
    """Build every SVG brand asset, keyed by file name."""
    left, top, width, height = mark_bounds()
    mark_viewbox = f"{left:.2f} {top} {width:.2f} {height}"
    core = "url(#core)"
    gradient = photoelastic_gradient()
    return {
        "mark-ink.svg": _doc(mark_viewbox, slabs(INK, INK), "Strain mark"),
        "mark-bone.svg": _doc(mark_viewbox, slabs(BONE, BONE), "Strain mark"),
        # Square, untiled marks for in-app use, e.g. the compact sidebar rail.
        "mark-core-ink.svg": _doc("0 0 64 64", gradient + slabs(INK, core), "Strain"),
        "mark-core-bone.svg": _doc("0 0 64 64", gradient + slabs(BONE, core), "Strain"),
        "favicon.svg": _doc(
            "0 0 64 64", _tile(INK, BONE, BONE, TILE_RADIUS, TILE_MARK_SCALE), "Strain"
        ),
        "app-icon.svg": _doc(
            "0 0 64 64",
            gradient + _tile(INK, BONE, core, TILE_RADIUS, TILE_MARK_SCALE),
            "Strain app icon",
        ),
        "app-icon-bone.svg": _doc(
            "0 0 64 64",
            gradient + _tile(BONE, INK, core, TILE_RADIUS, TILE_MARK_SCALE),
            "Strain app icon",
        ),
        "app-icon-maskable.svg": _doc(
            "0 0 64 64",
            gradient + _tile(INK, BONE, core, 0, MASKABLE_MARK_SCALE),
            "Strain app icon",
        ),
        "wordmark-light.svg": _lockup(INK, outlines),
        "wordmark-dark.svg": _lockup(BONE, outlines),
    }


def _render(svg: Path, size: int, output: Path) -> None:
    subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), str(svg), "-o", str(output)],
        check=True,
    )


def render_rasters(svgs: dict[str, str]) -> None:
    """Render PNG and ICO icons; small sizes use the flat favicon."""
    for tool in ("rsvg-convert", "magick"):
        if shutil.which(tool) is None:
            raise SystemExit(f"{tool} is required for --rasters")
    for size in (16, 32, 48):
        _render(BRAND_DIR / "favicon.svg", size, BRAND_DIR / f"icon-{size}.png")
    for size in (192, 512):
        _render(BRAND_DIR / "app-icon.svg", size, BRAND_DIR / f"icon-{size}.png")
    _render(BRAND_DIR / "app-icon-maskable.svg", 512, BRAND_DIR / "icon-maskable-512.png")
    with tempfile.TemporaryDirectory() as scratch:
        # Apple touch artwork is square; the platform applies its own corners.
        square = Path(scratch) / "apple.svg"
        square.write_text(svgs["app-icon.svg"].replace(f'rx="{TILE_RADIUS}"', 'rx="0"', 1))
        _render(square, 180, PUBLIC_DIR / "apple-touch-icon.png")
    small = [str(BRAND_DIR / f"icon-{size}.png") for size in (16, 32, 48)]
    subprocess.run(["magick", *small, str(PUBLIC_DIR / "favicon.ico")], check=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rasters", action="store_true", help="also render PNG and ICO files")
    args = parser.parse_args()
    svgs = build_svgs(OUTLINES.read_text())
    for name, content in svgs.items():
        (BRAND_DIR / name).write_text(content)
    if args.rasters:
        render_rasters(svgs)


if __name__ == "__main__":
    main()
