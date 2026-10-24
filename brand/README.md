# Strain brand system

Strain uses the skewed Point S mark in Bone & Ink with a photoelastic core, IBM
Plex Sans for headings, interface text and the wordmark, and IBM Plex Mono for
code and trace identifiers. This identity was selected on October 24, 2026 and
replaces the earlier Evolve/cobalt identity.

## Story

Clear materials such as acrylic show their internal stress as bands of color
under polarized light; this is photoelasticity. A part can look flawless to the
eye while the fringes show exactly where it will fail. Strain does the same for
AI agents: it puts them under adversarial load and shows where they give way.

- **Three layers.** An agent is a stack: instructions in, model reasoning in the
  middle, tools and actions out. The thin caps are the edges; the heavy core is
  where load concentrates.
- **Color only in the core.** Pressure shows where attacks land. The caps stay
  ink because they are the parts you already see and control.
- **One shear.** Every slab is cut at the same 14° angle, the moment before
  layers slip. The mark is still holding, but visibly under load. The angle is a
  design constant, not a physical one.
- **Point symmetry.** Rotated 180°, the mark is unchanged: attacker and defender
  see the same structure. It is also the S, built from layers, not from a font.
- **Restraint.** The interface is ink, white and neutral grey. Color appears only
  where something matters: stress in the mark, and severity in findings.

Short forms: "Clear plastic shows its stress as color under polarized light.
Strain does the same for AI agents." Taglines: "Stress-tested agents.", "See the
strain before it breaks.", "Crash-testing for AI agents."

## Files to use

- Production marks, lockups and icons: [`apps/web/public/brand`](../apps/web/public/brand).
- Asset generator (SVG, PNG, ICO):
  [`scripts/generate_brand_assets.py`](../scripts/generate_brand_assets.py).
- Lockup letter outlines used by the generator: [`wordmark-outlines.svg`](wordmark-outlines.svg).
- Editable text source: [`wordmark-editable.svg`](wordmark-editable.svg).
- Geometry, palette and severity values: [`design-spec.json`](design-spec.json).
- Font source files, licenses, and pinned checksums: [`fonts`](fonts).
- Canonical frontend colors and font declarations:
  [`apps/web/src/brand.css`](../apps/web/src/brand.css).
- Tailwind aliases: [`apps/web/src/styles.css`](../apps/web/src/styles.css).
- Exported palette snapshot: [`palette.json`](palette.json).

The ZIP kit and PDF guide under `output/` still show the retired cobalt identity
and have not been regenerated.

## The mark

Point S is three slabs sheared at 14°: a thin top cap flush right, a heavy
full-width core and a thin bottom cap flush left. It is point-symmetric, so it
reads the same rotated 180°.

| File                    | Use                                                    |
| ----------------------- | ------------------------------------------------------ |
| `mark-ink.svg`          | Flat bare mark on light surfaces                       |
| `mark-bone.svg`         | Flat bare mark on dark surfaces                        |
| `mark-core-ink.svg`     | Square mark, photoelastic core; in-app on light (rail) |
| `mark-core-bone.svg`    | Square mark, photoelastic core; in-app on dark (rail)  |
| `favicon.svg`           | Flat ink tile; browser favicons at 16–48px             |
| `app-icon.svg`          | Ink tile, photoelastic core; app and home-screen icons |
| `app-icon-bone.svg`     | Bone tile, photoelastic core; light presentations      |
| `app-icon-maskable.svg` | Square, mark inside the platform safe area             |
| `wordmark-light.svg`    | Ink lockup with photoelastic core; light surfaces      |
| `wordmark-dark.svg`     | Bone lockup with photoelastic core; dark surfaces      |

Do not edit these files by hand. Change the generator, then run
`uv run python scripts/generate_brand_assets.py --rasters` (needs `rsvg-convert`
and ImageMagick). A test fails if the committed SVGs drift from the generator.

The lockup letters are IBM Plex Sans Bold outlines in one solid color; do not
recolor individual letters or put the gradient in them. Keep at least half the
capital-letter height clear around the lockup. Use the lockup at 120px wide or
larger and the mark below that. Do not add shadows, strokes, rotation or a
different typeface.

## Photoelastic core

The photoelastic gradient is the only brand gradient: violet `#7C6CFF` → cyan
`#3FD0E0` → lime `#E9F46A` → pink `#FF8FB1` → violet `#9B7BFF`, running along
the slip direction. It is deliberately bright and stylized rather than a
realistic fringe pattern. It appears on the core slab of the mark only, in the
sidebar lockup, the compact sidebar mark, app icons from 32px, hero and social
art. Inside the app the mark sits directly on the surface; tiles are for app and
home-screen icons only. CSS uses the
`--photoelastic` token in `brand.css`.

Browser favicons, the bare marks and everyday UI stay flat. Never use the
gradient on letters, buttons, badges, backgrounds or anything next to findings,
so it cannot be confused with severity.

## Color roles

| Role                        | Light     | Dark      |
| --------------------------- | --------- | --------- |
| Page background and sidebar | `#FFFFFF` | `#0B0B0F` |
| Main text                   | `#0B0B0F` | `#EDE8DC` |
| Cards and popovers          | `#FFFFFF` | `#15151A` |
| Primary actions             | `#0B0B0F` | `#EDE8DC` |
| Text on primary             | `#EDE8DC` | `#0B0B0F` |
| Primary hover               | `#2A2A31` | `#F7F4ED` |
| Muted surfaces              | `#F4F4F6` | `#222228` |
| Selected and hover surface  | `#EEEEF1` | `#26262D` |
| Muted text                  | `#5A5A64` | `#A1A1AB` |
| Structural border           | `#E6E6EA` | `#2E2E35` |
| Input border                | `#7A7A86` | `#6E6E78` |

Light mode is white with ink and one family of cool neutral greys; the greys
lean slightly toward ink's blue undertone. Do not use warm or beige greys for
surfaces, borders or text. Bone is the brand's light tone: the mark on dark
surfaces, text on primary buttons, and the dark theme's text. It is never a light
page, sidebar or selection background. Dark mode keeps a slightly lighter sidebar
(`#222228`) so it separates from the ink page.

The interface has no brand hue, so severity is the color people notice. Use red
only for errors and destructive actions, yellow for warnings, green for success,
and the info pair for informational status. Every status needs words or an icon
as well as color. Chart colors are categorical roles, not a severity scale.

## Severity

Findings use signal bars plus the level as a word, not pills:

| Level  | Bars | Light     | Dark      |
| ------ | ---- | --------- | --------- |
| High   | 3    | `#C42B1F` | `#F26B5E` |
| Medium | 2    | `#C9561A` | `#F0914A` |
| Low    | 1    | `#A06B2E` | `#CFA36E` |

Unfilled bars use the same color at low opacity. The bar icons meet 3:1
against every light surface; the word beside them uses the normal text color.
Use `SeverityIcon` and `SeverityLabel` from
`apps/web/src/features/agents/severity.tsx`.

Primary text contrast exceeds 16:1 in both themes, muted text exceeds 5.8:1 on
every surface, and input borders exceed 3:1 on every surface they sit on.
Opacity, focus rings, disabled states and chart marks still need checking in
context.

## Typography and spacing

Use IBM Plex Sans 400 for body copy, 500 for labels and buttons, 600 for headings,
and 700 for strong headlines and the wordmark. Use IBM Plex Mono 400 or 500 only
for code, IDs, logs, and aligned numeric details. Do not use Mono for paragraphs.
Use tabular numerals where columns of numbers need comparison.

Suggested interface scale: 12px metadata, 14px controls and table text, 16px body,
20px section headings, 24px page headings, 32px major headings, and 48px marketing
headlines. Use 1.5 line height for body copy and about 1.15 for large headings.
Keep UI tracking normal; the wordmark's optical spacing is specific to the logo.

Use a 4px spacing unit with 8, 12, 16, 24, 32, 48, and 64px steps. The base corner
radius is 8px. Keep the existing Lucide icon family at consistent stroke weights.
The Point S mark is brand artwork, not a replacement for interface icons.

## Frontend implementation

`src/brand.css` is the source of truth. It defines self-hosted `@font-face` rules
and both theme palettes. `src/styles.css` imports it and provides semantic
Tailwind utilities. Use `bg-primary text-primary-foreground`,
`bg-accent text-accent-foreground`, and the matching status pairs. Do not put
new hex values or raw Tailwind color families in components. Update
`palette.json` and `design-spec.json` when the canonical theme changes.

Some literals cannot read CSS tokens and must be kept in sync by hand: the
`theme-color` tags in `index.html` (`#FFFFFF` light, `#0B0B0F` dark) and the
colors in `site.webmanifest` (`#0B0B0F`). The shadcn dialog and sheet backdrop
uses the stock `bg-black/50` scrim.

The sidebar selects the light/dark lockup with the application's `.dark` class.
Its home link provides the accessible name, so the nested logo images have empty
alt text. Elsewhere, give a standalone wordmark the alt text `Strain`.

The favicon, touch icon, manifest and light/dark `theme-color` are wired in
`apps/web/index.html`. PNG and ICO files are rendered from the SVGs by the
asset generator.
The manifest provides home-screen metadata; it does not add offline support.
Fonts are served from `public/fonts` without external font requests.

## Font provenance and license

The font files come from the [Google Fonts repository](https://github.com/google/fonts)
at commit `0b58fb370093f9a9f4ff785d94405710b79de67c`, dated March 3, 2026.
Original downloads and SHA-256 checksums are recorded in
[`fonts/SOURCES.json`](fonts/SOURCES.json). The typefaces are published by
[IBM Plex](https://github.com/IBM/plex) under SIL Open Font License 1.1.
Keep the bundled OFL notices with redistributed font files.

The desktop TTFs are the original downloads. Web WOFF2 files are lossless
container conversions with all glyphs retained. Logo paths are outlined artwork;
they do not require distribution of the font to display correctly.
