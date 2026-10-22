# Strain

Product monorepo, currently containing quality tooling only.

Install **Git**, **make**, and **[mise](https://mise.jdx.dev/getting-started.html)**
and make sure all three commands are on `PATH`. Supports macOS and Linux;
use WSL2 on Windows. No separate Node, pnpm, uv, or Python installation is needed.

Clone the repository, enter its directory, and run:

```sh
make setup   # Install pinned runtimes, dependencies, tools, and the pre-push hook
make check   # Run security scans, linting, type checks, and tests
make test    # Run tests
make format  # Fix formatting and safe lint issues
```

`make setup` trusts this repository's `mise.toml` and installs its pinned Node,
pnpm, and uv versions. uv installs the Python version in `.python-version` and
creates `.venv`. Only run setup in a checkout you trust. Existing global tool
versions can stay installed; Make selects this project's versions with
`mise exec`, including when called by the pre-push hook. Shell activation is
not required.

Run setup in each new clone/worktree and after dependency or tool updates; it is
safe to rerun after an interrupted installation. For individual tool commands,
use `mise exec --`, for example `mise exec -- node --version`.

`make dev` runs the root package's `dev` script. The `prototype/hackathon` branch
provides the frontend and that script; `main` currently contains quality tooling.

Checks then run automatically before pushes and in CI on every branch push and PR.
Open a PR and wait for green CI before merging.

CI installs only mise before running the same `make setup` and `make check` on
Linux and macOS. Node and pnpm versions in `mise.toml` must match `.node-version`
and `package.json`; tests catch accidental differences. Update those pins together.

With existing custom hooks, add `make check` to pre-push and use
`make setup INSTALL_HOOKS=0`.

GitHub currently reports failures but does not block merges; required checks
need a plan supporting this private repository.

See [AGENTS.md](AGENTS.md) for coding rules.
