# Strain brand system

Strain uses the Evolve wordmark, cobalt and Zinc colors, IBM Plex Sans for
headings and interface text, and IBM Plex Mono for code and trace identifiers.
The A and I in STRAIN carry the brand accent. This identity was selected on
October 24, 2026.

## Files to use

- Production logos and monograms: [`apps/web/public/brand`](../apps/web/public/brand).
- Editable text source: [`wordmark-editable.svg`](wordmark-editable.svg).
- Geometry and sizing: [`design-spec.json`](design-spec.json).
- Font source files, licenses, and pinned checksums: [`fonts`](fonts).
- Canonical frontend colors and font declarations:
  [`apps/web/src/brand.css`](../apps/web/src/brand.css).
- Tailwind aliases: [`apps/web/src/styles.css`](../apps/web/src/styles.css).
- Exported palette snapshot: [`palette.json`](palette.json).
- Complete handoff: [`strain-brand-kit.zip`](../output/brand/strain-brand-kit.zip).
- Illustrated guide: [`strain-brand-guide.pdf`](../output/pdf/strain-brand-guide.pdf).

The ZIP contains outlined SVGs, transparent PNGs at 1200px and 2400px widths,
an editable SVG, standalone monograms, app icons, ICO and Apple touch icons,
a 1200 x 630 social card, desktop/web fonts with licenses, theme CSS, palette
data, and the guide. Outlined SVGs need no installed font. Install the bundled
IBM Plex Sans variable font before editing the text-based source.

## Logo rules

Use `wordmark-light.svg` on white or very light neutral surfaces. Use
`wordmark-dark.svg` on charcoal surfaces; its AI accent is pale blue for contrast.
Use the monochrome black, white, or cobalt version when the medium requires one
color. The assets have transparent backgrounds except the app icons and social
card. Do not recolor individual letters outside the supplied variants.

Keep at least half the capital-letter height clear on every side of the wordmark.
Its small internal export padding is not a substitute for this clear space.
Use the full wordmark at 120px wide or larger; use the AI monogram below that.
Use the app icon at 24px or larger, with the supplied 16px favicon as a browser
exception. Keep aspect ratio and letter spacing intact. Do not add shadows,
gradients, strokes, rotation, or a different typeface.

The wordmark is built from IBM Plex Sans Bold at weight 700, normal width,
with -24 font units of tracking on a 1000-unit em. Its source paths are actual
font outlines. The earlier generated concept board was a direction study;
these files are the production artwork.

The rounded app icon suits web UI. The square maskable icon keeps its monogram
inside the central safe area for platform cropping. Apple touch artwork is
square so the platform supplies its own corners.

## Color roles

| Role                        | Light     | Dark      |
| --------------------------- | --------- | --------- |
| Brand and primary actions   | `#2563EB` | `#93C5FD` |
| Text on primary             | `#FFFFFF` | `#18181B` |
| Primary hover               | `#1D4ED8` | `#BFDBFE` |
| Page background             | `#FAFAFA` | `#09090B` |
| Main text                   | `#18181B` | `#FAFAFA` |
| Cards and popovers          | `#FFFFFF` | `#18181B` |
| Muted surfaces              | `#F4F4F5` | `#27272A` |
| Muted text                  | `#52525B` | `#A1A1AA` |
| Selected or hovered surface | `#EFF6FF` | `#172554` |
| Text on selected surface    | `#1E40AF` | `#DBEAFE` |
| Structural border           | `#E4E4E7` | `#3F3F46` |
| Input border                | `#71717A` | `#71717A` |

Use red only for errors and destructive actions, yellow for warnings, green for
success, and the info pair for informational status. Every status needs words
or an icon as well as color. Chart colors are categorical roles, not a severity
scale. Keep secondary UI surfaces neutral and reserve cobalt for emphasis.

The primary button text contrasts are 5.17:1 in light mode and 9.82:1 in dark
mode. All defined opaque text/surface pairs exceed 4.5:1. Opacity, focus rings,
disabled states, and chart marks still need verification in their actual context.

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
The AI monogram is brand artwork, not a replacement for interface icons.

## Frontend implementation

`src/brand.css` is the source of truth. It defines self-hosted `@font-face` rules
and both theme palettes. `src/styles.css` imports it and provides semantic
Tailwind utilities. Use `bg-primary text-primary-foreground`,
`bg-accent text-accent-foreground`, and the matching status pairs. Do not put
new hex values or raw Tailwind color families in components. Update the exported
palette and kit when the canonical theme changes.

The sidebar selects the light/dark SVG with the application's `.dark` class.
Its home link provides the accessible name, so the nested logo images have empty
alt text. Elsewhere, give a standalone wordmark the alt text `Strain`.

The favicon, touch icon, and manifest are already wired in `apps/web/index.html`.
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
