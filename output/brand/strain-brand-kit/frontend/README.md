# Strain frontend assets

This handoff targets the existing Tailwind CSS 4 and shadcn/ui application.
The Strain repository is already integrated. These instructions are for reuse
in another frontend.

1. Copy the contents of `public/` into your application's public asset directory.
   Preserve its `brand/` and `fonts/` paths.
2. Copy `brand.css` beside your global CSS and import it. It includes the local
   font declarations and light/dark semantic colors.
3. Merge the aliases in `tailwind-theme.css` into your Tailwind 4 theme. Keep
   your existing Tailwind imports and unrelated component styles.
4. Add the metadata in `head-snippet.html` to your HTML head.
5. Apply `font-sans` to the application and `font-mono` only to code and IDs.
6. Toggle `.dark` on the document root for dark mode. Use the matching wordmark
   file for that theme; the external SVG does not inspect the parent DOM class.

The color variables contain HSL channels; aliases deliberately wrap them in
`hsl()`. Pair surfaces with their foreground tokens. Use `bg-primary` with
`text-primary-foreground` and `hover:bg-primary-hover`. Destructive buttons and
badges should use `text-destructive-foreground`, not a hard-coded text color.

Use `/brand/wordmark-light.svg` on light surfaces and
`/brand/wordmark-dark.svg` on dark surfaces. `/brand/app-icon.svg` fits the compact
mobile rail. A standalone logo image needs `alt="Strain"`; if its parent link
already has `aria-label="Strain home"`, use empty alt text to avoid duplication.

The manifest provides home-screen metadata. It does not install a service
worker or add offline support. Font requests are served locally from `/fonts/`.

The CSS in this kit is an export. In the Strain repository, continue editing
`apps/web/src/brand.css` as the source of truth and regenerate handoff copies
when the brand changes.
