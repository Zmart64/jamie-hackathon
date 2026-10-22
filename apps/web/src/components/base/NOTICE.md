# Untitled UI source attribution

Selected free components, `src/utils/cx.ts`, and the light theme are adapted from
[untitleduico/react](https://github.com/untitleduico/react) at commit
`1d410cb8facde8d50869e7bbb5f3d048e2267466` (retrieved 22 October 2026).

Upstream paths: `components/base/buttons/button.tsx`,
`components/base/input/input.tsx`, `components/base/badges/badges.tsx`,
`utils/cx.ts`, and `styles/theme.css`.

Adaptations: only the needed button/input/text-badge variants are included;
unused polymorphic links, password controls and icon detection are omitted.
Lucide replaces the upstream icon family. Theme uses an indigo brand, system
fonts and light mode only. React Aria public per-component imports avoid loading
unrelated declarations that currently conflict with exact optional property
checking through its umbrella entry point. No global typing rules are relaxed.

These files are intentionally small subsets, not drop-in replacements for the
full upstream APIs. Add upstream features deliberately and run `make check`.
No PRO code or templates are included. Preserve this notice on updates.

MIT License

Copyright (c) 2025 Untitled UI

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
