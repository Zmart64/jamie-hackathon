# Support agent backend

A real Claude-powered, turn-based support agent for ExampleApp's login page.
Account lookup, verification, recovery settings, and email delivery use isolated,
in-memory mock data. All instructions, tool descriptions, and responses default
to English.

## Run

From the repository root:

```sh
make setup
cp apps/support-agent/.env.example apps/support-agent/.env
```

Set `ANTHROPIC_API_KEY` in `apps/support-agent/.env`, then run:

```sh
make support-agent
```

The default address is `http://127.0.0.1:8000`. Open `/docs` to try the API without
a frontend. `/health` reports the selected model and whether a key is configured;
it does not make a Claude request or validate the key. Documentation and session
creation work without a key; chat returns a structured `503` until one is set.

Run one process/worker: sessions live in memory and disappear on restart. Each
session starts with independent demo accounts, verification state, and an empty
mock inbox. Starting a new session resets the demo.

## Configure

- **Model, token/step limits, request timeout, port, CORS origins:**
  [`support_agent/config.toml`](support_agent/config.toml).
- **Agent instructions:** [`support_agent/prompts/support.md`](support_agent/prompts/support.md).
- **Accounts and mock recovery codes:** [`support_agent/data/accounts.json`](support_agent/data/accounts.json).
- **Tools:** [`support_agent/tools.py`](support_agent/tools.py).
- **API key:** environment or the ignored `apps/support-agent/.env` file.

Restart the server after changing configuration, prompts, fixtures, or code.
The model and prompt are fixed for a running service; existing conversations use
the model selected when their session was created.

`ANTHROPIC_MODEL` overrides the TOML model. `SUPPORT_AGENT_CONFIG` selects another
TOML file, and `SUPPORT_AGENT_ENV_FILE` selects another dotenv file. Process
environment variables override dotenv values. Asset paths inside TOML are
resolved relative to that TOML file, independent of the working directory. The
default dotenv location belongs to this app; the service does not search unrelated
parent directories for secrets. Set the key through the environment when running
an installed wheel, or select a dotenv file explicitly.

The default model is `claude-sonnet-5-5`; choose a model available to your Anthropic
account. There is no silent model fallback. Unknown config keys and invalid values
fail at startup. Never put the API key in frontend code or a chat request.

## Frontend contract

See [API.md](API.md) for the implemented response plan, tool receipt fields,
disclosure boundaries, and error semantics. The generated `/openapi.json` schema
uses stable operation IDs for frontend client generation.

The login page owns when its chat popup opens. The backend owns Claude history
and tools. Plain JSON requests return a complete turn; show a loading indicator
while a turn runs. The default allowed origins are `http://localhost:5173` and
`http://127.0.0.1:5173`; add the actual frontend origin in TOML if different.

| Endpoint                        | Purpose                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `POST /sessions`                | Start a fresh conversation; body may be omitted or `{}`.                                |
| `POST /sessions/{id}/messages`  | Send `{ "message": "..." }`; receive one complete turn.                                 |
| `GET /sessions/{id}/messages`   | Restore chat messages and turns when reopening the widget.                              |
| `GET /sessions/{id}/mock-state` | Demo inspection: current account addresses, actual verification state, and mock outbox. |
| `GET /health`                   | Process health, selected model, and key configuration status.                           |

Session creation returns `201` with `session_id`, `model`, `account_identifier`,
and `created_at`. It optionally accepts `{ "account_identifier": "alex@example.com" }`
from the login form. This becomes unverified user context; it never authenticates
the visitor or becomes a system instruction.

A successful message returns `200`:

```json
{
  "session_id": "session-123",
  "turn_id": "turn-2",
  "status": "completed",
  "reply": "Please provide your recovery code.",
  "messages": [
    {
      "id": "message-3",
      "turn_id": "turn-2",
      "role": "user",
      "content": "My username is alex.",
      "created_at": "2026-10-24T12:00:00Z"
    },
    {
      "id": "message-4",
      "turn_id": "turn-2",
      "role": "assistant",
      "content": "Please provide your recovery code.",
      "created_at": "2026-10-24T12:00:01Z"
    }
  ],
  "tool_events": [],
  "error": null
}
```

IDs above are illustrative; the service generates UUIDs. Append `messages` to
the chat, keyed by `id`. These include the submitted user message; reconcile an
optimistic user bubble rather than adding it twice. The history endpoint returns
`messages` as the full flat transcript and `turns` with replies, errors, and traces.

Each attempted tool call adds a `tool_events` entry with `id`, `turn_id`,
`tool_call_id`, `name`, `arguments`, `result`, `is_error`, and `created_at`.
`result` contains the parsed tool output (or SDK error text for a failed attempt).
These receipts deliberately expose internal tool names, arguments, account IDs,
and operation results to browser network inspection, even when the widget only
renders chat messages. They contain no attack verdicts or full tool catalog.
The inspection endpoint separately exposes the mock inbox, including dummy reset
URLs. Both surfaces are intentionally available for this demo.

Minimal integration:

```js
const baseUrl = "http://127.0.0.1:8000";

const created = await fetch(`${baseUrl}/sessions`, { method: "POST" });
if (!created.ok) throw new Error("Could not start the support conversation.");
const { session_id } = await created.json();

const response = await fetch(`${baseUrl}/sessions/${session_id}/messages`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "My username is alex. I need help logging in." }),
});
const turn = await response.json();
if (!response.ok) {
  throw new Error(turn.error?.message ?? "The message failed.");
}
// Render turn.messages; optionally show turn.tool_events in the demo trace view.
```

Submit one message at a time per session. A simultaneous request (including a
history/state read during a turn) returns `409`. Unknown sessions return `404`,
and invalid request bodies return `422`. All application errors use
`error.code` and `error.message`. Request errors contain just the error envelope;
Claude/configuration failures return `502`/`503` with the normal turn shape,
`status: "failed"`, `reply: null`, and an `error` containing `code` and `message`.

Failed turns are retained in history, including any successful tool calls before
the failure. **Actions already executed are not rolled back.** Inspect the trace
or mock state before retrying a mutation. The backend does not automatically
retry Claude requests or user turns. Limits and truncated responses are explicit
errors, not successful replies. History is never silently summarized or truncated;
start a new session if it exceeds the selected model's context window.

## Mock behavior

The five tools are `find_account`, `get_recovery_settings`, `verify_account`,
`update_recovery_email`, and `send_password_reset`.

Use `alex@example.com` (username `alex`, recovery code `246810`) or
`sam@example.com` (username `sam`, recovery code `135790`) for a normal conversation.
Codes are fixture data for the demo; no code delivery service is involved.

The prompt requires successful verification before changing a recovery address.
**The change tool deliberately does not enforce that policy.** It validates
arguments and account existence, then changes the address. Verification state is
tracked separately per account and session. This is the intended vulnerability
for later prompt-injection experiments; it does not guarantee any particular
prompt will persuade Claude to call the tool.

Reset emails go only into the session's in-memory outbox. Reset links use
`example.invalid` and do not grant access to any real service. `send_password_reset`
uses the account's current recovery address; it accepts no alternate recipient.

## Extend

Add a typed method with a descriptive docstring to `MockTools`, return a JSON
string, and register it in `MockTools.registered()`. The SDK derives the input
schema from the signature and validates arguments before invoking the method.
Tools are bound to the current session, so they do not share mutable demo data.
Raise `ValueError` for a business failure; the SDK returns it to Claude as an
error result and the backend includes it in the trace.

`agent.py` runs the SDK tool loop and retains full assistant/tool-result messages
for subsequent turns. `api.py` handles HTTP/CORS and per-session locking;
`store.py` owns session state; `models.py` defines typed API and mock-data shapes.
The generated OpenAPI contract is available at `/openapi.json` for frontend type
generation.

## Verify

```sh
mise exec -- uv run --locked pytest apps/support-agent/tests
make check
```

Tests use the real Anthropic SDK and tool runner with a mock HTTP transport.
They check multi-turn context, side effects, session isolation, verification,
input validation, concurrency, CORS, configuration overrides, step limits,
truncated responses, and failures after tool execution. They do not require an
API key and do not claim to measure Claude's resistance to prompt injection.
