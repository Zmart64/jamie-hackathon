# Strain

Product monorepo for Strain. This foundation contains quality tooling and its
tests; no application framework or product code has been chosen yet.

## Start

Install Node **24.22.0**, pnpm **11.25.0** and uv **0.13.1**, then:

```sh
make setup
make check
```

uv installs the Python **3.13.16** runtime selected by `.python-version` when needed.
`make format` fixes safe Ruff issues and formats supported files. CI only checks;
it never rewrites code. `pnpm check` is an alias for `make check`.

## What is enforced

| Area                    | Check                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| Python                  | Ruff lint/format; strict Pyright                                                         |
| JavaScript / TypeScript | TypeScript strict (`checkJs` included); type-aware ESLint                                |
| Formatting              | Prettier for JS/TS, JSON, YAML and Markdown                                              |
| Maintainability         | Maximum 500 nonblank lines per source file; complexity 10; Python function statements 50 |
| Tests                   | pytest, currently testing the custom source-size gate                                    |
| Reproducibility         | Pinned runtimes/package managers, committed lockfiles, frozen installs                   |

Checks discover sources throughout the repo, including new directories. Dependency
and build output directories are excluded. The size check uses tracked and new
nonignored source files; comments count toward the limit. No generated source is
exempt by default. Prefer small, cohesive modules over splitting to satisfy a number.

`AGENTS.md` supplies short coding instructions for agents. The tool configuration
and CI enforce the mechanical rules; tests and human review assess behavior and
design. A green check does not prove that code is correct.

## As product code arrives

- Use `apps/` for applications and `packages/` for shared libraries. pnpm already
  discovers packages in both. Declare Python workspace members in `pyproject.toml`
  when adding Python packages, and install their dependencies through uv.
- Root TypeScript settings cover the initial sources. When introducing package
  tsconfigs, extend the strict settings and update the root check to check every
  project; never let a new package silently escape CI.
- When a frontend is chosen, add its appropriate test runner and production build
  to `make check`. There is no placeholder frontend test/build reporting success.
- Add deployment only after choosing an application and hosting target.

## GitHub enforcement

CI runs the single `quality` job on every PR and push to `main`, without path
filters or optional checks. It uses read-only permissions and actions pinned to
commit SHAs. Open PRs for changes and review changes to quality configuration.

**Required checks are not currently enforced by GitHub.** The private `strain-ai`
organization is on Free; the GitHub API rejects branch protection/rulesets for this
repository. After upgrading to a plan that supports private-repo rules, require
pull requests and the `quality` check on `main`, block force pushes and deletion,
and disallow bypass. Require another review once there is a second maintainer.
Until then, CI can report a failure but GitHub can still permit a merge or direct push.

Dependabot proposes weekly dependency and action updates; updates are never
automatically merged. It uses GitHub's supported `npm`, `uv` and `github-actions`
[ecosystems](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).
Keep updates small, update their lockfiles, and run `make check`.
