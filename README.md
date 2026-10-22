# Strain

Product monorepo with shared quality tooling and a local interview prototype.

Install **Git**, **make**, and **[mise](https://mise.jdx.dev/getting-started.html)**
and make sure all three commands are on `PATH`. Supports macOS and Linux;
use WSL2 on Windows. No separate Node, pnpm, uv, or Python installation is needed.

Clone the repository, enter its directory, and run:

```sh
make setup   # Install pinned runtimes, dependencies, tools, and the pre-push hook
make check   # Run security scans, linting, type checks, and tests
make test    # Run tests
make format  # Fix formatting and safe lint issues
make dev     # Open the frontend at http://127.0.0.1:5173
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

## Hackathon prototype

`apps/web` uses React, Vite, TypeScript, Tailwind, selected free Untitled UI
components and Lucide icons. The reference screen uses simulated refund evidence;
it does not connect to an agent or payment system or commit us to that scenario.
`make check` includes frontend interaction tests and the production build.

Read [the design conventions](apps/web/AGENTS.md) and
[the UI choice and tradeoffs](apps/web/DESIGN.md) before adding screens.

Use `prototype/hackathon` as the integration branch. Each teammate branches from
it for a focused task and opens a PR targeting it. Agree on ownership of shared
components, theme tokens, dependencies and configuration before concurrent edits.
Keep those changes in small PRs; avoid all four people pushing directly to the
integration branch. Run `make setup` in each clone so the pre-push checks work.

After the branch is published, teammates with repository access can start with:

```sh
git fetch origin
git switch --track origin/prototype/hackathon
make setup
make dev
```

For a task, create your own branch from `prototype/hackathon` and target that
integration branch when opening the PR.

### Optional Untitled UI MCP

The frontend runs without an MCP connection. Each teammate who wants component
discovery in Codex configures the official server in their own Codex MCP settings,
or adds this table to their user `~/.codex/config.toml` (only once):

```toml
[mcp_servers.untitledui]
url = "https://www.untitledui.com/react/api/mcp"
enabled = true
```

Start a new Codex session and ask it to search the Untitled UI MCP for free table
components. Free access needs no purchase or login. OAuth is optional for PRO
access; the CLI's add command may automatically open that sign-in flow.
See the [official MCP guide](https://www.untitledui.com/react/integrations/mcp).

Reuse our shared components first, use MCP discovery for missing patterns, then
adapt selected free source to the existing theme and Lucide icons. The current
components are manually adapted subsets, not a CLI-initialized Untitled starter;
automatic installation needs its paths/configuration checked first. Do not run a
starter initializer over this app or replace our shared controls wholesale.
Keep account credentials and personal Codex configuration outside the repository.
