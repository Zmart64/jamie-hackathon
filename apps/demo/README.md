# Carbon Zero demo

Carbon Zero is the target application used by Strain's assessments. Its two
services live together here:

| Directory                      | Role                                                       | Runtime                                     |
| ------------------------------ | ---------------------------------------------------------- | ------------------------------------------- |
| [`frontend`](frontend)         | Login page and Sprout chat widget                          | React, TypeScript and Vite (`@strain/demo`) |
| [`backend`](backend/README.md) | Support API, Claude agent and isolated mock recovery tools | Python and FastAPI (`support-agent`)        |

They run as separate processes. The frontend sends chat requests to
`/api/support`; Vite proxies that route to the backend at `http://127.0.0.1:8000`.
API credentials belong only in the backend's environment. Login credentials
are never sent to the backend; the login form always rejects password submissions.

## Run locally

From the repository root, run `make setup`, then create the backend configuration
if it does not already exist:

```sh
cp apps/demo/backend/.env.example apps/demo/backend/.env
```

Set `ANTHROPIC_API_KEY` in that file. Start these commands in separate terminals:

```sh
make support-agent  # API at http://127.0.0.1:8000
make dev-demo       # UI at http://127.0.0.1:5174
```

The default proxy needs no frontend configuration. To use another backend URL,
copy `frontend/.env.example` to `frontend/.env` and set `SUPPORT_AGENT_URL` there.
Production hosting must provide the same proxy route; Vite's proxy is for
development. Sessions and simulated recovery results stay in memory.

See [backend setup](backend/README.md) and the [API contract](backend/API.md)
for model configuration, mock tools, diagnostics and error responses.

## Checks

`make check` at the repository root covers both services, the platform and the
redteam agent. To run only Carbon Zero's tests:

```sh
mise exec -- pnpm --filter @strain/demo test
mise exec -- uv run --locked pytest apps/demo/backend/tests
```
