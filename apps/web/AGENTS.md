# Frontend conventions

- Use React + TypeScript, Vite, Tailwind CSS 4 and shadcn/ui (Radix). Reuse
  `src/components/ui` before adding components. Lucide is the only icon family.
- Use only free, open-source components and blocks from the official shadcn
  registry. Do not add paid/PRO components or another UI kit. Compose UI controls
  from the shared shadcn components rather than hand-styling native controls.
- Use the cobalt/Zinc semantic tokens and IBM Plex fonts in `src/brand.css`.
  `src/styles.css` imports that source of truth and exposes Tailwind aliases
  wrapping HSL channels with `hsl()`. Do not invent colors in components.
  Use the Evolve logo assets in `public/brand`; see `../../brand/README.md`.
- `components.json` configures the official shadcn registry. Review generated
  code and pin dependencies. Keep source attribution in `src/components/NOTICE.md`.
- Use standard component APIs and composition. Keep local integration changes
  small and documented. No blanket lint, type, formatting or size exemptions.
- Inputs need labels, icon-only buttons need accessible names, decorative icons
  should be hidden from assistive technology. Preserve visible keyboard focus
  and reduced-motion support. Status needs words as well as color.
- Visible actions must work. Include applicable empty, error and disabled states.
  Label fixtures as sample data. This starter has no backend; edits reset on refresh.
  The account menu's Account and Log out entries and the Company sidebar's
  Settings, API Keys and Billing buttons, plus Security's Agent Firewall button,
  are intentionally inert placeholders, as requested for this prototype.
- Verify desktop (1280px), 200% zoom and mobile (390px). Only wide table regions
  should scroll horizontally. Check keyboard controls and light/dark themes.
- Add meaningful interaction and failure/recovery tests. Run `make check`, which
  includes strict types, React hooks lint, tests and the production build.
