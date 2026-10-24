import re

import pytest
from generate_brand_assets import (
    BRAND_DIR,
    OUTLINES,
    PHOTOELASTIC,
    ROOT,
    SLABS,
    build_svgs,
)

SVGS = build_svgs(OUTLINES.read_text())


@pytest.mark.parametrize("name", sorted(SVGS))
def test_committed_brand_svgs_match_the_generator(name: str) -> None:
    committed = (BRAND_DIR / name).read_text()
    assert committed == SVGS[name], f"Run scripts/generate_brand_assets.py to refresh {name}"


def test_mark_is_point_symmetric_about_the_grid_center() -> None:
    rotated = {(64 - x - w, 64 - y - h, w, h) for x, y, w, h in SLABS}
    assert rotated == set(SLABS)


def test_gradient_stays_on_the_core_slab_and_off_small_icons() -> None:
    assert "Gradient" not in SVGS["favicon.svg"]
    names = ("app-icon.svg", "mark-core-ink.svg", "mark-core-bone.svg", "wordmark-light.svg")
    for name in (*names, "wordmark-dark.svg"):
        # One gradient reference: the core slab. Caps and letters stay solid.
        assert SVGS[name].count("url(#core)") == 1, name


def test_css_token_uses_the_same_photoelastic_stops() -> None:
    css = (ROOT / "apps" / "web" / "src" / "brand.css").read_text()
    token = re.search(r"--photoelastic: linear-gradient\(([^;]+)\);", css)
    assert token is not None
    colors = re.findall(r"#[0-9a-fA-F]{6}", token.group(1))
    assert [color.upper() for color in colors] == [color for _, color in PHOTOELASTIC]


def test_lockup_rejects_incomplete_outlines() -> None:
    with pytest.raises(ValueError, match="expected 6 STRAIN glyph outlines"):
        build_svgs("<svg></svg>")
