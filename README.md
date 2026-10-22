# Strain

Product monorepo, currently containing quality tooling only.

Requires Git, make, Node **24.22.0**, pnpm **11.25.0**, and uv **>=0.13.1,<0.14**
(CI uses **0.13.1**).
Supports macOS and Linux; use WSL2 on Windows. uv installs the pinned Python version.

```sh
make setup   # Install dependencies, tools, and the pre-push hook
make check   # Run security scans, linting, type checks, and tests
make format  # Fix formatting and safe lint issues
```

Run setup in each new clone/worktree and after dependency or tool updates.
Checks then run automatically before pushes and in CI on every branch push and PR.
Open a PR and wait for green CI before merging.

With existing custom hooks, add `make check` to pre-push and use
`make setup INSTALL_HOOKS=0`.

GitHub currently reports failures but does not block merges; required checks
need a plan supporting this private repository.

See [AGENTS.md](AGENTS.md) for coding rules.
