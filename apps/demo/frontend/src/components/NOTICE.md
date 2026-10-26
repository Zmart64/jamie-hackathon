# Component source attribution

Button, Input and Label are reused unchanged from the existing official shadcn/ui
primitives in `apps/platform/src/components/ui`. Local copies keep this independently
deployable demo from importing another application's source. They retain standard
shadcn APIs; Carbon Zero supplies its own theme and composition in `src/styles.css`.

Source: [shadcn/ui](https://github.com/shadcn-ui/ui), MIT licensed.
The brand mark, Sprout outline and chat reaction choreography are original to this demo.

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

## Sprout avatar rendering

Sprout uses [bot-avatars](https://github.com/Jakubantalik/Libraries.dev/tree/main/packages/bot-avatars),
MIT © 2026 Jakub Antalik. This is an avatar renderer, not a replacement UI kit;
controls continue to use shadcn/ui. No Pro presets or Studio exports are used.

Version 0.2.2 was pinned for the initial plush rendering and custom outline.
It was published on October 2, 2026, less than 30 days before this integration;
the older 0.1.1 release does not support fabric, so this is a focused exception
to the usual preference for releases at least 30 days old. No existing dependency
was upgraded. The package has no runtime dependencies beyond its React peer.

Sprout now uses the package's public simulation and plastic renderer directly,
with synchronized body and accessory layers for darker leaves and feet. Canvas
resolution follows display density with at least 2× sampling. The small message
avatars are still poses; the launcher pauses offscreen and with reduced motion.

MIT License

Copyright (c) 2026 Jakub Antalik

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
