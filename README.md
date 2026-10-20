# Strain

Product monorepo for Strain. This foundation contains quality tooling and its
tests; no application framework or product code has been chosen yet.

## Start

Everyone working on Strain uses this repository's committed configuration, including
agents. Install Git, make, Node **24.22.0**, pnpm **11.25.0** and uv **0.13.1**, then
run these commands in each new clone or worktree:

```sh
make setup
make check
```

uv installs the Python **3.13.16** runtime selected by `.python-version` when needed.
CI uses the exact Node version above; local Node **>=24.14.0 <25** is supported.
Setup also installs checksum-verified Gitleaks and actionlint binaries into
`.tools/` on macOS and Linux (ARM64 or x64). No Go installation is needed.
On Windows, use a Linux environment such as WSL2. Native Windows is not supported.
Setup installs the shared pre-push hook: subsequent `git push` commands run the
full checks automatically and stop when a check fails. Run setup again after
dependency or tool updates. Git does not install hooks simply by cloning.
`make format` fixes safe Ruff issues and formats supported files. CI only checks;
it never rewrites code. `pnpm check` is an alias for `make check`.

## Everyday workflow

1. Make a focused change on a branch. Use `make format` when formatting needs fixing.
2. Commit and push. The installed pre-push hook runs `make check` automatically.
3. Open a PR and wait for green CI before merging. GitHub also checks every branch
   push, even before a PR is opened; PRs run their own checks against the base branch.

`make check` remains available for earlier feedback. Editors do not automatically
run the full suite on save. Both engineers and agents use the same commands.
Local hooks can be bypassed; GitHub checks run independently of them.

If setup finds existing custom hooks, it stops rather than hiding them. Either add
`make check` to your existing pre-push hook and use `make setup INSTALL_HOOKS=0`, or
deliberately switch to this repository's `.githooks` directory and rerun setup.
`make hooks` installs just the hook configuration.

## What is enforced

| Area                    | Check                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| Python                  | Ruff lint/format, public return annotations, focused security rules; strict Pyright       |
| JavaScript / TypeScript | TypeScript strict (`checkJs` included); type-aware ESLint                                 |
| Formatting              | Prettier for JS/TS, JSON, YAML and Markdown                                               |
| Maintainability         | Maximum 500 nonblank lines per source file; complexity 10; Python function statements 50  |
| Tests                   | pytest covers source size, tool installation, secret scanning, and push hooks             |
| Security                | Gitleaks scans history, staged content, and current tracked/new files; output is redacted |
| CI configuration        | actionlint validates workflow syntax and expressions                                      |
| Reproducibility         | Pinned runtimes/package managers, committed lockfiles, frozen installs                    |

Checks discover sources throughout the repo, including new directories. Dependency
and build output directories are excluded. The size check uses tracked and new
nonignored source files; comments count toward the limit. No generated source is
exempt by default. Prefer small, cohesive modules over splitting to satisfy a number.
Narrow, explained exceptions to size or complexity limits can be reviewed when
splitting would reduce clarity; do not raise the global limits. Public Python
functions require return annotations, while private return types may be inferred.
Use `Any` narrowly at third-party boundaries; there is no blanket ban.

Run `make check` before pushing, or `make security` for the security checks alone.
Staged content is checked independently, even if the working file was cleaned later.
The working-tree secret scan includes unstaged and untracked nonignored files,
even tracked files later added to `.gitignore`; ignored local `.env` files and
symlink targets are not scanned. CI fetches full history so deleting a leaked
secret does not hide it. Scanning detects common secret patterns, not every secret.
Actionlint's optional ShellCheck/Pyflakes integrations are disabled so results do
not depend on extra tools installed on a developer's machine.

The standalone tools are pinned in `scripts/tools.json`. To update them, select an
upstream release, verify and update its archive SHA-256 values, run `make setup`,
then `make check`. Dependabot does not update this manifest. The tools run directly
without a paid Action wrapper.

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

CI runs the single `quality` job on every PR and every branch push, without path
filters or optional checks. It uses Ubuntu 24.04, read-only permissions, and actions pinned to
commit SHAs. Open PRs for changes and review changes to quality configuration.
It can also be started manually from GitHub's Actions tab once on the default branch.

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
Dependabot vulnerability alerts and security update PRs are also enabled in this
repository's GitHub settings (separate from the weekly version-update config).
They do not automatically merge updates or block merges. Re-enable those settings
when creating a new repository from this foundation.

These rules cover the Strain monorepo, currently the organization's only repository.
New repositories must explicitly adopt their own CI and setup; GitHub does not
automatically inherit these files across an organization.
