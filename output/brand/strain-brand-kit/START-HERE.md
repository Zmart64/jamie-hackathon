# Strain brand kit

The approved identity is **Evolve + cobalt + IBM Plex**. The production wordmark
uses actual IBM Plex Sans Bold outlines, with AI highlighted in cobalt.

## Pick the right file

- **Web, design tools, or print:** use an outlined SVG from `logos/`. It stays
  sharp at every size and needs no installed font.
- **Slides, documents, or image uploads:** use the transparent PNGs in `logos/`.
  Each logo comes at 1200px and 2400px widths.
- **On light backgrounds:** `strain-wordmark-light.svg` or its PNG version.
- **On dark backgrounds:** `strain-wordmark-dark.svg` or its PNG version.
- **One-color reproduction:** use the mono-black, mono-white, or mono-cobalt file.
- **App or profile image:** use `icons/strain-app-icon-1024.png`.
- **Browser favicon:** use `icons/favicon.ico` or `icons/strain-app-icon.svg`.
- **Apple home screen:** use `icons/apple-touch-icon.png`.
- **Platform masking:** use `icons/icon-maskable-512.png`; it has a square
  full-bleed background and a safely centered monogram.
- **Social sharing:** use `social/strain-social-card-1200x630.png`.

The square icons are intentional; operating systems add their own crop where
appropriate. The rounded SVG/PNG is available for interfaces that need it.

## Typography

Use IBM Plex Sans 400 for body copy, 500 for labels and controls, 600 for headings,
and 700 for the wordmark and strong headlines. Use IBM Plex Mono 400 or 500 for
code, logs, and trace identifiers. The original desktop fonts are in
`fonts/desktop/`, and self-hosted web fonts are in `fonts/web/`.

To edit the source letters, install `fonts/desktop/IBMPlexSans-Variable.ttf` and
open `sources/wordmark-editable.svg`. For everyday placement, use the outlined
production SVGs. Keep the included OFL licenses with any redistributed fonts.

## Palette and usage

Primary cobalt is `#2563EB`; the dark-mode accent is `#93C5FD`. Neutrals are Zinc.
Use the supplied light/dark semantic token pairs rather than choosing new colors
inside individual components. Red is for errors, yellow for warnings, and green
for success. Pair status color with a label or icon.

Keep clear space equal to half the capital-letter height around the wordmark.
Minimum wordmark width: 120px. Use the monogram below that. Minimum app icon:
24px, with the supplied 16px browser favicon as an exception. Do not stretch,
rotate, add effects, or change the letter spacing.

## Frontend handoff

See `frontend/README.md`. That folder contains ready-to-copy public assets,
self-hosted font files, theme CSS, Tailwind aliases, and head metadata.
The Strain repository already uses these colors, fonts, logos, and icons.
Its canonical theme is `apps/web/src/brand.css`.

The four-page `strain-brand-guide.pdf` illustrates the identity, typography,
color roles, sizing, and handoff. `sources/` contains the editable source,
geometry specification, palette snapshot, and pinned font provenance.
