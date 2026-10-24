# App shell

The app uses React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui with Radix
primitives and Lucide icons. It is a client-only prototype whose shell is based on the
[official dashboard example](https://ui.shadcn.com/examples/dashboard).
`components.json` records the `new-york` style and import aliases.
All shared UI components come from the free, MIT-licensed shadcn/ui registry;
no paid/PRO components or licenses are required.

The previous interview screens and Untitled UI/React Aria dependencies are removed.
The home page (`/`) and `/agents` both open the agent inventory. The dashboard
page, its metrics, chart, document table, and navigation entry have been removed
from the app. The sidebar's Red Team group contains Agents; a matching Security
group below it contains the intentionally inert Agent Firewall button.
History API routes preserve in-memory agents and assessments when moving
between the home page, inventory, and individual agents. Each agent has a UUID
and a `/agents/<uuid>` URL. Agent pages show an Agents → agent name breadcrumb
in the header; browser Back and Forward also work. A deployed host must serve
the app entry point for these paths (Vite handles this during development).
The sidebar uses the standard non-collapsing API, with a compact, always-visible
icon rail below 768px. Company and page headers share a height and border baseline.
The account footer uses a local placeholder picture and a shadcn dropdown with
Account and Log out. These entries intentionally perform no action;
selecting one only dismisses the menu. The header shows the current page title
without a theme toggle. The shadcn Vite theme provider preserves a previously saved
theme preference and defaults to light.

The Company sidebar group sits at the bottom, above the account footer, and
contains Settings, API Keys and Billing in that order. Its buttons support hover
and keyboard focus, with accessible icons in the mobile rail. These are intentionally
inert placeholders: clicking or activating them leaves the page unchanged.

The original dashboard's standalone components and their tests remain in the
source tree but are not imported into the app. There is no authentication, backend
or deployment configuration.

## Source integration

Components were installed with the official shadcn CLI from `dashboard-01`.
Source and license are in `src/components/NOTICE.md`. The starter keeps the
example's layout and shadcn component styling, with these integration changes:

- Lucide replaces the example's Tabler icons, keeping one icon family.
- The sidebar is separated into state/context, layout and menu modules. Its
  skeleton width is deterministic and its mobile hook uses `useSyncExternalStore`.
- The original chart tooltip exposes only the example's dot tooltip, with a
  typed Recharts boundary. Unsupported generic tooltip/legend variants are omitted.
- The example's table is composed from shadcn primitives with local state and a
  sheet editor. This avoids unused drag-and-drop and table-engine dependencies.
- The Vite theme provider supports light/dark mode and tolerates unavailable local
  storage. It avoids the Next.js-specific theme script in a client-only app.
- Chart and toast colors wrap the HSL tokens in `hsl()`. Sidebar aliases derive
  from the same palette.

## Brand system

The selected identity is Evolve with cobalt/Zinc colors, IBM Plex Sans for the UI
and wordmark, and IBM Plex Mono for code and trace identifiers. `src/brand.css`
owns the light/dark semantic colors and locally hosted font declarations;
`src/styles.css` imports it and maps tokens to Tailwind utilities. Use these roles
instead of adding component-specific colors. The wordmark uses IBM Plex Sans Bold
outlines with cobalt AI letters. The compact AI icon appears in the mobile rail.

Production SVGs are in `public/brand`, and font files and their OFL licenses are
in `public/fonts`. The favicon, Apple touch icon, and web manifest use the same
monogram. The manifest supplies home-screen metadata, not offline functionality.
Button and badge variants use paired destructive foreground tokens in both
themes; primary hover uses its dedicated token. See `../../brand/README.md` for
asset use, typography, source details, and the complete downloadable kit.

Standard strict type, lint, source-size and formatting checks cover all UI source.
No vendor error baseline, `skipLibCheck`, or UI exclusions are used.

## Dependency compatibility

Recharts 3.10.1 depends on Redux Toolkit. A declaration-only pnpm patch for
`@reduxjs/toolkit@2.13.0` keeps library checking enabled with TypeScript 6 and
`exactOptionalPropertyTypes`. It preserves optionality in the thunk config
intersection instead of remapping it through `Id`, and declares the existing
`TaskAbortError` behavior where `code` may be undefined. Runtime code is unchanged.
Remove the patch when upstream declarations support these settings.

Most new versions are at least 30 days old. Radix 1.8.1 is a deliberate exception:
1.6.7's select/popper declarations conflict under exact optional-property checking.
The current version passes the same strict checks without a Radix patch.

## Development

Run `make dev` from the repository root. Use `make format` and `make check` before
finishing changes. Vitest and Testing Library cover filtering, empty-state
recovery, pagination, selection, column visibility, form validation, edit/delete/
undo, chart range selection, theme storage fallback, persistent navigation and account
menu keyboard behavior and placeholder actions.

## Agents demo

Canvas node icons use Wrench for setup/baseline, Radar for attack surface,
Brain for planning, Crosshair for attack attempts, ShieldCheck for verification,
ShieldBan for blocked paths, ShieldAlert for findings, and CircleHelp for coverage
gaps. Browser steps and preview headers use the Google Chrome logo. Final report
notes use NotepadText; consolidation uses Brain.

The Agents workspace composes the existing shadcn primitives with the official
Breadcrumb, Dialog, Progress, and Textarea components, added through the pinned shadcn CLI
on October 24, 2026 after consulting the shadcn MCP registry and examples.
The Progress integration forwards its value
to the Radix root so assistive technology can announce the numeric progress.

The demo includes six sample agents and these interactions:

- Agent search with empty-state recovery and Add agent in the top navigation bar.
- One add-agent modal with a name, connection method, and URL (email address for
  Mail). Browser is preselected; API endpoint and Mail are also available.
- Add creates an untested agent with History (0), an empty assessment map, and
  empty Findings. Run assessment starts a deterministic 20-second Carbon Zero
  story for every name, connection method and address. No entered address is contacted.
- New runs reveal setup (0–3s), mapping (3–8s), planning (8–10s), three staggered
  browser tests (10–17s), and a verification step after every trace (15–18s).
  Separate outcome nodes confirm two blocked attempts and one recovery change
  (16–18.5s). All three outcomes feed into consolidation (18.5–19.5s), followed
  by a finding and report notes (19.5–20s). Blocked counts only update after their
  outcomes finish; blocked attempts are not findings. Selecting verification or
  outcome nodes shows the matching scripted tool/account-state evidence. Final
  notes cover the tested scope, controls that held, the finding, and follow-up.
  Each run uses its own wall clock, catches up after background throttling, and
  continues while navigating or inspecting a browser session.
- Four local, silent browser clips play automatically, without media controls.
  Expanding a preview opens a shadcn Dialog synchronized to the same assessment
  clock. Completed clips hold their final frame. The footage uses the actual
  Carbon Zero UI with scripted API responses; its recovery-change trace is a
  matching fixture, not a live security result. Asset provenance is in
  `public/demo/carbon-zero/README.md`.
- A left-to-right assessment canvas with compact shadcn node cards, smooth branching
  connectors, pan/zoom controls, fit-to-view, and a minimap. Finding branches expand
  into attack, verification, and finding steps. Selecting a node opens evidence in
  a nonmodal shadcn details panel inside the map. It docks beside the canvas on
  desktop and stays within the map bounds on smaller screens. Other nodes and
  page navigation remain usable; Close and Escape return focus to the selected
  node. Blocked and inconclusive paths always remain visible.
  The Carbon Zero camera follows new steps until manual pan/zoom, ending on the
  consolidation and its finding/report outputs. Reduced motion disables camera transitions and node animation.
  Mobile keeps the horizontal layout; previews expand to fit the screen.
- Step-by-step recorded-attempt replay remains available on the older sample
  assessments. Previous assessments are opened through History.
- Retesting older sample findings with a demo fix creates a new full assessment. The chosen finding
  stops reproducing; other findings and previous evidence remain.
- Untested agents, a recoverable simulated connection failure, incomplete tests,
  and unknown permissions.

All data is in React state and resets on refresh. Deep links to newly added
agents therefore show a recovery page after refresh. Sample scans use fixed
historical dates; newly started scans show the actual time in Europe/Berlin.
The canvas uses the free MIT-licensed React Flow engine (`@xyflow/react` 12.11.6,
released September 1, 2026), with custom shadcn cards, badges, and controls. The
reference screenshot guides the layout; no paid registry components are used.
React Flow's attribution remains visible. The graph pans inside a bounded viewport;
only the inventory table uses horizontal scrolling. Nodes are recorded assessment
steps, so dragging, connecting, and deleting nodes are disabled. Arrow keys pan
the focused canvas; tabbing to a step centers it before inspection.

React Flow's `@xyflow/system` 0.0.82 declarations have an
[upstream optional-property compatibility issue](https://github.com/xyflow/xyflow/issues/6038).
`patches/@xyflow__system@0.0.82.patch` adds explicit `undefined` to the 21 optional
`NodeBase` fields that generic internal-node types already expose. The patch touches
only ESM/UMD declarations and leaves runtime code unchanged. Strict typing and
library checking remain enabled. Remove the patch when upstream fixes these types.
Behavioral tests cover setup validation, default Browser connection, search,
left-to-right graph connections, branch expansion/collapse, zoom, map-scoped evidence
and focus recovery, branch selection, replay, failure recovery, explicit scan starts, and selecting
preserved assessments from History.
The Carbon Zero tests also cover exact timing, independent runs, background
catch-up, delayed findings, graph geometry, synchronized expansion, final frames,
and unavailable media.
