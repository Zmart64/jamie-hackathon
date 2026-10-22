# Prototype UI decision

Decision: use a small **free Untitled UI + React Aria** foundation with **Lucide**.
Reviewed on 22 October 2026 with a second agent. Optimize for four people building
a coherent interview prototype quickly, with Linear's visual restraint.

| Option      | Benefits for this prototype                                                                                                            | Costs                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Untitled UI | More pre-decided visual patterns; coherent semantic tokens; free navigation, tables, tabs and controls; first-party Figma relationship | Full page examples are PRO; imported code needs review; adapting to an exact Linear clone would lose the speed advantage |
| shadcn/ui   | Small, flexible, fully MIT foundation; easy to add individual components; good for a bespoke execution inspector                       | More page composition and visual decisions fall to the team                                                              |

Both provide editable source and both can produce clean, accessible interfaces.
Untitled wins narrowly here because consistency and speed of assembly matter more
than maximal flexibility. No paid assets or account are required for this setup.
This is an adapted subset of free components, not the complete Untitled catalog
or a drop-in implementation of every upstream prop. Add capabilities as needed.

The [vendor comparison](https://www.untitledui.com/blog/untitled-ui-vs-shadcn)
correctly highlights composition as a cost. Its component totals include variants
and should not be treated as an apples-to-apples measure of usefulness. Complete
paid pages are also a different offering from the free subset used here.

The two systems can coexist in React, but that does not align their APIs, form
contexts, primitive dependencies or tokens. We choose one system for the
prototype; adding both is not a shortcut. Sources:
[Untitled introduction](https://www.untitledui.com/react/docs/introduction),
[free sidebar patterns](https://www.untitledui.com/react/components/sidebar-navigations),
[free tables](https://www.untitledui.com/react/components/tables),
[shadcn introduction](https://ui.shadcn.com/docs),
[Untitled license and MIT exception](https://www.untitledui.com/license).

## Visual direction and glass

Adopt Linear's hierarchy and restraint, not a pixel-for-pixel copy: quiet
navigation, consistent actions, limited accent color, clear type and gentle
borders. Readability in screen sharing matters more than decorative effects.
[Linear's design explanation](https://linear.app/now/behind-the-latest-design-refresh)
describes reducing navigation and separator emphasis.

Liquid Glass can work for a small navigation/control surface. Apple's guidance
places it above content, not across evidence or tables. macOS 27's refinements
do not make native material rendering a free capability of a React website.
Our assessment: simulated refraction adds implementation and visual QA cost
without improving this interview. Start opaque. A restrained translucent header
can be evaluated later with an opaque fallback and reduced-transparency support.
Sources: [Apple materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials),
[macOS 27 AppKit design updates](https://developer.apple.com/videos/play/wwdc2026/289/).

## Scope and checks

The sample refund view demonstrates the theme, controls, evidence and reset/search
behavior. It is a starting point, not a selected hackathon scenario or working
security product. No backend, authentication, deployment or shared UI package.

The root TypeScript check excludes `apps/web` because its own config extends the
same strict settings and is explicitly invoked by the root typecheck command.
This preserves coverage while allowing browser/JSX settings. Frontend tests and
Vite's production build are part of `make check`; existing gates remain intact.
Vitest 4 is pinned because Vitest 5's assertion types conflict with the installed
Testing Library matchers under full declaration checking; no `skipLibCheck`.

Keep new components small and tested. Use `pnpm --filter @strain/web test` for
focused development, then `make check` before sharing changes.
