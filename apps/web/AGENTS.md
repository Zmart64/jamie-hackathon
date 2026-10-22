# Frontend conventions

- Use React + TypeScript, free Untitled UI patterns on React Aria, and Lucide.
  Start with the shared components in `src/components/base`. Add only what a
  screen needs. Keep paid assets out unless team access is explicitly established.
- One visual system: do not introduce shadcn, Base UI, Radix or a second icon kit
  alongside it. Custom Strain evidence views compose our shared controls.
- Use the semantic tokens in `src/styles/theme.css`: `bg-primary`, `bg-secondary`,
  `text-primary`, `text-tertiary`, `border-secondary`, `bg-brand-solid`, etc.
  Raw colors belong in that theme, not feature files. Do not overwrite text and
  background tokens as if they shared one meaning: Untitled separates them.
- Light theme, neutral surfaces, indigo accent, system sans, 14–16px body text.
  Use Tailwind's 4px spacing scale, 8px control corners and restrained borders.
  Navigation recedes; the current task and its evidence get the visual emphasis.
- Lucide defaults to 16px and 1.75 stroke. Use labels for icon-only controls and
  hide decorative icons from assistive technology. No custom decorative SVGs.
- Use the shared button's `color` and `onPress` APIs. Inputs need a label. Keep
  keyboard focus visible, respect reduced motion, and show status with words as
  well as color. Use the badge's `color` variant for consistent status styling.
- Keep evidence, tables and forms opaque. No glass cards, glow, decorative
  gradients or refraction libraries. Any future translucent navigation must have
  an opaque fallback and remain readable with reduced transparency.
- Every visible action must work. Include applicable empty, pending, error and
  disabled states. Label fixtures as simulated; don't invent metrics or claims.
- Check desktop screen sharing (1280px), 200% zoom and a 390px viewport. Layout
  should reflow; only genuinely wide code/table regions may scroll horizontally.
- Test meaningful interactions and failure/recovery paths. `make check` runs
  strict app types, React hooks lint, icon import restrictions, tests and build.
  Semantic tokens, composition and visual quality also require review; lint does
  not prove good design or accessibility.
- Preserve source attribution for copied components. The current components are
  intentionally adapted subsets; read `src/components/base/NOTICE.md` before
  updating from upstream. No blanket lint/type/size exemptions for UI code.
