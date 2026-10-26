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
in the header; `/agents/<uuid>/findings` adds a Findings breadcrumb. The optional
`assessment` query selects a specific run on either page, preserving historical
reports and their return links. Browser Back and Forward also work. A deployed host must serve
the app entry point for these paths (Vite handles this during development).
The sidebar uses the standard non-collapsing API, with a compact, always-visible
icon rail below 768px. Company and page headers share a height and border baseline.
The account footer uses a local placeholder picture and a shadcn dropdown with
Account, a theme switch and Log out. Account and Log out intentionally perform no action;
selecting one only dismisses the menu. The header shows the current page title.
The account menu's Dark mode / Light mode entry switches the theme. The shadcn
Vite theme provider saves that choice in local storage, restores it on load and
defaults to light; without storage the switch still works for the session.

The Company sidebar group sits at the bottom, above the account footer, and
contains Settings, API Keys and Billing in that order. Its buttons support hover
and keyboard focus, with accessible icons in the mobile rail. These are intentionally
inert placeholders: clicking or activating them leaves the page unchanged.

The original dashboard's standalone components, fixtures and tests have been
removed along with Recharts and its Redux compatibility patch. There is no
authentication, backend or deployment configuration.

## Source integration

Components were installed with the official shadcn CLI from `dashboard-01`.
Source and license are in `src/components/NOTICE.md`. The starter keeps the
example's layout and shadcn component styling, with these integration changes:

- Lucide replaces the example's Tabler icons, keeping one icon family.
- The sidebar is separated into state/context, layout and menu modules. Its
  skeleton width is deterministic and its mobile hook uses `useSyncExternalStore`.
- The Vite theme provider supports light/dark mode and tolerates unavailable local
  storage. It avoids the Next.js-specific theme script in a client-only app.
- Toast colors wrap the HSL tokens in `hsl()`. Sidebar aliases derive
  from the same palette.

## Brand system

The selected identity is the skewed Point S mark in Bone & Ink (`#EDE8DC` and
`#0B0B0F`) with a photoelastic core, IBM Plex Sans for the UI and wordmark, and
IBM Plex Mono for code and trace identifiers. `src/brand.css` owns the light/dark
semantic colors and locally hosted font declarations; `src/styles.css` imports it
and maps tokens to Tailwind utilities. Use these roles instead of adding
component-specific colors.

Light mode is white (page and sidebar) with ink text and actions and one family
of cool neutral greys for muted surfaces, the selected/hover state, borders and
muted text. Dark mode is ink with bone text. Severity is the only saturated color
in the interface: High shows three red bars, Medium two tangerine bars and Low one
ochre bar, always with the level as a word.

The lockup pairs the mark with solid one-color IBM Plex Sans Bold outlines. The
bright photoelastic gradient appears only on the mark's core slab: in the sidebar
lockup, the untiled mark in the compact rail, and the app icons. Browser favicons stay flat.
Production SVGs, PNGs and the ICO in `public/brand` come from
`scripts/generate_brand_assets.py`; do not edit them by hand. Font files and their
OFL licenses are in `public/fonts`. The manifest supplies home-screen metadata,
not offline functionality.
Button and badge variants use paired destructive foreground tokens in both
themes; primary hover uses its dedicated token. See `../../brand/README.md` for
asset use, the brand story, typography and source details.

Standard strict type, lint, source-size and formatting checks cover all UI source.
No vendor error baseline, `skipLibCheck`, or UI exclusions are used.

## Dependency compatibility

Most new versions are at least 30 days old. Radix 1.8.1 is a deliberate exception:
1.6.7's select/popper declarations conflict under exact optional-property checking.
The current version passes the same strict checks without a Radix patch.

## Development

Run `make dev` from the repository root. Use `make format` and `make check` before
finishing changes. Vitest and Testing Library cover agent filtering, empty-state
recovery, setup validation, assessments, findings and evidence, theme storage
fallback, persistent navigation, account menu keyboard behavior and placeholder actions.

## Agents demo

Canvas node icons use Wrench for setup/baseline, Radar for attack surface,
Brain for planning, Crosshair for attack attempts, ShieldCheck for verification,
ShieldBan for blocked paths, ShieldAlert for findings, and CircleHelp for coverage
gaps. Browser steps and preview headers use the Google Chrome logo. Final report
notes use NotepadText. Each verification card becomes its outcome in place.

The Agents workspace composes the existing shadcn primitives with the official
Breadcrumb, Dialog and Progress components, added through the pinned shadcn CLI
on October 24, 2026 after consulting the shadcn MCP registry and examples.
The Progress integration forwards its value
to the Radix root so assistive technology can announce the numeric progress.

The demo includes six sample agents and these interactions:

- Agent search with empty-state recovery and Add agent in the top navigation bar.
- One add-agent modal with a name, connection method, and URL (email address for
  Mail). Browser is preselected; API endpoint and Mail are also available.
- Add creates an untested agent with History (0), an empty assessment map, and
  empty Findings. Run assessment starts the same 24.5-second Carbon Zero playback
  for every input. No entered address is contacted.
- The source is `output/demo/real-run/demo-real-run-01`. All four session JSON
  files and state snapshots are bundled in `src/features/agents/recording` along
  with the original timeline, board, tool log, and incomplete attacker-message
  index. Session JSON is authoritative; the index omits the first injection.
- The canvas starts with Setting up agent (0–1s), then restores the original
  prerecorded mapping walkthrough (1–6s). Its preview is stacked above the mapping
  card, as before. This introductory clip uses scripted responses; it has no
  session transcript.
- Four concurrent branches each play their entire footage over 15 seconds:
  S1 system-context injection (6–21s), S2 reset check (6.5–21.5s), S3 tool-result
  injection (7–22s), and S4 persistence (7.5–22.5s). Browser playback rates adapt
  to each original clip’s duration; no footage is cut. Source timestamps remain
  unchanged in the evidence. The source conversations ran sequentially;
  concurrent branches are a presentation choice.
- Each branch has one verification/outcome card. It verifies for one second,
  then changes its label, icon, and status to the outcome. All four cards connect
  directly to a single centered Create findings node (23.5–24.5s), which ends the
  pipeline. The two successful injections and S4 persistence probe
  support the same recovery-verification flaw. Two refused change requests are
  counted separately; 18 assessed turns include discovery and diagnostic requests
  and must not be interpreted as 18 exploit attempts.
- Every session exposes its complete messages, tool calls with arguments/results
  and errors, and final state. Messages appear at their source time; final state
  appears after the branch clip. Create findings opens the dedicated report page,
  with the shared board, timeline, tool log, and full session evidence.
- Four local silent clips are cropped from the source recording for legible
  chat text. Preview and expanded clip follow the same assessment clock and
  hold their last frame. Expanded views show only the session title and video,
  with a close button. Video failure leaves the transcript and tool evidence
  usable. Asset provenance and
  reproduction instructions are in `public/demo/assessment/README.md`.
- A left-to-right assessment canvas with compact shadcn node cards, smooth branching
  connectors, pan/zoom controls, fit-to-view, and a minimap. Finding branches expand
  into attack, verification, and finding steps. Selecting a finding opens the Findings
  page. Other nodes open evidence in
  a nonmodal shadcn details panel inside the map. It docks beside the canvas on
  desktop and stays within the map bounds on smaller screens. Other nodes and
  page navigation remain usable; Close and Escape return focus to the selected
  node. Blocked and inconclusive paths always remain visible.
  The Carbon Zero camera follows new steps until manual pan/zoom, ending on the
  verified outcomes and the final Create findings node. Reduced motion disables camera transitions and node animation.
  Mobile keeps the horizontal layout; previews expand to fit the screen.
- Findings opens a report with High, Medium, and Low totals and numbered findings ordered by
  severity. Each finding shows its severity, impact, and expandable reproduction
  evidence. Status and confirmation badges, explanatory ordering text, remediation
  blocks, activity metrics, coverage gaps, introductory summaries, an overall total
  box, and scope/limitation cards are omitted from this page.
  Findings with captured screenshots show titled previews without session labels,
  timestamps or descriptions; each opens in a keyboard-accessible image dialog. The recorded
  recovery finding reuses the S1, S3, and S4 success frames. Missing images can be
  retried without losing access to the transcript and tool evidence.
  Recorded reports include all four conversations with tool
  events and state snapshots, and the original board, tool log, and timeline.
  Running, untested, failed, incomplete, and unavailable reports have distinct states.
- Step-by-step recorded-attempt replay remains available on attempt nodes in older sample
  assessments. Previous assessments are opened through History.
- Starting an assessment from an older finding replays the same pipeline run.
  There is no simulated-fix path; previous assessments remain in History.
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
