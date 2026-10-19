# Working in Strain

This is the product monorepo. It currently contains quality tooling only.

- Put deployable applications in `apps/` and reusable libraries in `packages/`
  when they are needed. Do not create empty apps or speculative abstractions.
- Read the nearest instructions and existing code before editing. Keep each
  change focused on the requested behavior.
- Use Python 3.13, uv, Node 24 and pnpm at the pinned versions. Commit lockfile
  updates with dependency changes. `make setup` installs the locked dependencies.
- Run `make check` before finishing; it is the same command CI uses. Report any
  checks you could not run. `make format` applies safe lint fixes and formatting.
- Python requires type annotations and strict Pyright checks. JS/TS uses strict
  type checking and type-aware ESLint. Handle promises explicitly.
- Keep modules focused; the enforced maximum is 500 nonblank source lines,
  including comments. Complexity is capped at 10; Python statements per function
  are capped at 50. Do not split files merely to game these limits.
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
