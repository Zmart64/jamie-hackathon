# shadcn/ui source attribution

The UI primitives, dashboard card/chart layout and sample data originate from
[shadcn/ui](https://github.com/shadcn-ui/ui), installed from the official
[`dashboard-01` registry](https://ui.shadcn.com/r/styles/new-york-v4/dashboard-01.json)
on October 22, 2026 using the shadcn CLI. Local integration changes are documented
in `../../DESIGN.md`. This is a Vite integration, not an unchanged Next.js example.

The theme provider follows the [official Vite dark-mode guide](https://ui.shadcn.com/docs/dark-mode/vite).
The Avatar component was added from the official registry on October 23, 2026.
`public/avatars/justus.png` is the user-provided penguin image used for the demo account.

Breadcrumb, Dialog, Progress, and Textarea were added from the official `@shadcn` registry
on October 24, 2026 with the pinned shadcn CLI. The shadcn MCP provided registry
discovery, usage examples, install commands, and the audit checklist. Progress
additionally forwards its numeric value to the Radix root for accessibility.

The Evolve/cobalt identity and IBM Plex typography were selected on October 24, 2026. `src/brand.css` provides the palette. The Button and Badge integrations use
semantic primary-hover and destructive-foreground tokens so light and dark
foreground colors stay paired. Logos in `public/brand` use IBM Plex Sans Bold
outlines. IBM Plex fonts are licensed under SIL OFL 1.1; licenses are bundled in
`public/fonts`, with pinned sources and checksums in `brand/fonts/SOURCES.json`
at the repository root. Brand usage is documented in `brand/README.md`.

The assessment canvas uses [React Flow](https://github.com/xyflow/xyflow),
`@xyflow/react` 12.11.6, under its MIT license (Copyright © 2019–present webkid GmbH).
Its attribution remains visible in the canvas. Node cards and controls compose the
existing shadcn primitives; the reference screenshot is visual guidance only.
The narrow declaration-only compatibility patch is documented in `../../DESIGN.md`.

At the user's request, browser steps and previews use the Google Chrome logo from
[Google's Chrome website](https://www.google.com/chrome/static/images/chrome-logo-m100.svg),
saved unchanged as `public/brand/google-chrome.svg` on October 24, 2026. This brand
asset is a specific exception to the Lucide-only icon convention; Google retains
its rights to the logo. The rest of the interface continues to use Lucide icons.

The upstream shadcn MIT license follows:

MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
