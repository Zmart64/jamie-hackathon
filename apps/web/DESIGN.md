# Dashboard starter

The app uses React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui with Radix
primitives, Lucide icons and Recharts. It is a client-only dashboard based on the
[official dashboard example](https://ui.shadcn.com/examples/dashboard).
`components.json` records the `new-york` style and import aliases.
All dashboard components come from the free, MIT-licensed shadcn/ui registry;
no paid/PRO components or licenses are required.

The previous interview screens and Untitled UI/React Aria dependencies are removed.
The dashboard contains sidebar navigation, four metric cards,
a visitor area chart and a document table. Dashboard is the only navigation entry
and links to the root page; analytics and documents are sections of that page.
The sidebar uses the standard non-collapsing API, with a compact, always-visible
icon rail below 768px. Company and page headers share a height and border baseline.
The account footer uses a local placeholder picture and a shadcn dropdown with
Account, Settings and Log out. These entries intentionally perform no action;
selecting one only dismisses the menu. The header shows the current page title
without a theme toggle. The shadcn Vite theme provider preserves a previously saved
theme preference and defaults to light. Sample metrics are not live business data.

Documents use the example's fixture data. Search, status filters, page selection,
column visibility, pagination, adding, editing, deletion and undo work in memory.
Refreshing restores the fixtures. There is no authentication, backend or deployment
configuration. The chart displays fixed dates ending June 30, 2024; selecting a
range uses exactly 7, 30 or 90 samples, independent of the current date.

## Source integration

Components were installed with the official shadcn CLI from `dashboard-01`.
Source and license are in `src/components/NOTICE.md`. The starter keeps the
example's layout and shadcn component styling, with these integration changes:

- Lucide replaces the example's Tabler icons, keeping one icon family.
- The sidebar is separated into state/context, layout and menu modules. Its
  skeleton width is deterministic and its mobile hook uses `useSyncExternalStore`.
- The chart tooltip exposes only the dot tooltip this dashboard uses, with a
  typed Recharts boundary. Unsupported generic tooltip/legend variants are omitted.
- The example's table is composed from shadcn primitives with local state and a
  sheet editor. This avoids unused drag-and-drop and table-engine dependencies.
- The Vite theme provider supports light/dark mode and tolerates unavailable local
  storage. It avoids the Next.js-specific theme script in a client-only app.
- Chart and toast colors wrap the supplied HSL tokens in `hsl()`; their numeric
  values are unchanged. Sidebar aliases derive from the same palette.

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
