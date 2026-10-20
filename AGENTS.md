# Working in Strain

This is the product monorepo. It currently contains quality tooling only.

- Put deployable applications in `apps/` and reusable libraries in `packages/`
  when they are needed. Do not create empty apps or speculative abstractions.
- Read the nearest instructions and existing code before editing. Keep each
  change focused on the requested behavior.
- Use the pinned Python 3.13, uv and pnpm versions. CI pins Node's patch version;
  local Node 24 versions matching `package.json` are supported. Commit lockfile
  updates with dependency changes. Run `make setup` in each new clone/worktree;
  it installs dependencies, tools, and the shared pre-push hook.
- Run `make check` before finishing; it is the same command CI uses. Report any
  checks you could not run. `make format` applies safe lint fixes and formatting.
- Python uses strict Pyright and requires public return annotations. Prefer
  precise types; use Any narrowly when third-party boundaries require it. JS/TS
  uses strict type checking and type-aware ESLint. Handle promises explicitly.
- Keep modules focused; the enforced maximum is 500 nonblank source lines,
  including comments. Complexity is capped at 10; Python statements per function
  are capped at 50. Do not split files merely to game these limits. A narrow,
  explained exception may be reviewed when splitting would hurt readability;
  change only that case's enforcement, never the global limits.
- Add meaningful tests for behavioral changes, particularly failures and edge
  cases. Do not add dummy tests or weaken assertions to obtain a green check.
- Do not silently weaken rules, exclusions, types, tests or CI. Explain policy
  changes in the PR. Use narrow, explained suppressions only when justified.
- Never commit secrets. Use environment variables and safe `.env.example` values.
- When adding the first frontend, choose its framework and test/build tools, then
  wire both tests and the production build into `make check`. For Python apps,
  declare their dependencies in the uv workspace and keep all tests discoverable.
- Prefer existing dependencies. Do not add deployment infrastructure until the
  application and hosting target are decided.
