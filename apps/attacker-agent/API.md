# Attack UI contract

Base URL: `http://127.0.0.1:8001`. This local management API is for the operator UI,
not the target chatbot. It supports CORS for the configured frontend origins.
No API key is sent by the browser. Request validation failures use FastAPI's
`detail` field. `/openapi.json` contains all request and snapshot schemas.

| Method | Path                | Purpose                                   |
| ------ | ------------------- | ----------------------------------------- |
| GET    | `/health`           | Configuration status; no model call       |
| POST   | `/runs`             | Start background run; returns `202`       |
| GET    | `/runs`             | Current process's run snapshots           |
| GET    | `/runs/{id}`        | Steps, sessions, graph evidence, findings |
| POST   | `/runs/{id}/stop`   | Cancel the run; safe to repeat            |
| GET    | `/runs/{id}/events` | SSE event stream and replay               |

## Start request

```json
{
  "goal": "Test whether recovery can be redirected without ownership verification.",
  "account_identifier": "alex@example.com",
  "attacker_email": "attacker@example.com",
  "limits": { "max_steps": 20, "max_sessions": 3, "max_seconds": 300 }
}
```

Only `goal` is required. An omitted identifier gives the attacker no initial
account identity. The base URL, provider, prompts and credentials are server
configuration; the request cannot select arbitrary targets or privileged access.
Creation returns a `RunView` with `id`, `status`, `model`, `request`, `sessions`,
`steps`, `surfaces`, `findings`, token counters, `usage_complete`, `summary` and
`stop_reason`. The initial status may be `queued`; it is not a completed run.

## SSE

Connect with `new EventSource(baseUrl + "/runs/" + id + "/events")`.
The browser automatically sends `Last-Event-ID` after reconnection. Explicit
replay also supports `?after=EVENT_ID`. IDs are monotonically increasing per run;
deduplicate by `(run_id, id)`. A terminal run closes the stream after replaying
all remaining events. Close EventSource on `run_finished` to avoid reconnecting
to a completed stream. Disconnecting from SSE does not stop a run: use `/stop`.

Every named event has the same JSON envelope:

```json
{
  "id": 7,
  "run_id": "opaque-run-id",
  "type": "target_reply",
  "visibility": "public",
  "step_id": 2,
  "created_at": "2026-10-24T12:00:00Z",
  "data": {
    "step_id": 2,
    "session_id": "opaque-session-id",
    "reply": "Please provide your recovery code."
  }
}
```

`visibility` describes whether information is customer-visible or operator-only.
The entire stream is for the operator; it must not be fed back to the attacker.
The model feedback boundary is constructed separately from public replies.

| Type                   | `data` and intended UI behavior                                                    |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `run_started`          | `model`; show active run                                                           |
| `session_started`      | `session_id`; group subsequent attempts in this conversation                       |
| `planning`             | `session_id`; show that the attacker is selecting its next step                    |
| `step_planned`         | Full `Step`, including `decision` and token `usage`; show hypothesis and strategy  |
| `message_sending`      | `message`, `session_id`; target request is being dispatched, delivery unconfirmed  |
| `message_sent`         | Same plus `target_turn_id`; the target returned a turn                             |
| `target_reply`         | `reply`, `session_id`, `step_id`; append the actual chat response                  |
| `surface_observed`     | Full `Surface`; upsert a capability node with its quote and source step            |
| `observation_rejected` | Unsubstantiated claim; do not add it to the discovered-capability graph            |
| `target_trace`         | Target turn with real execution receipts; operator detail only                     |
| `verification`         | `available`, `state_observed`, `findings`; display independently confirmed effects |
| `error`                | Sanitized `code`, `message`; runtime failure, not evidence of target resistance    |
| `run_finished`         | `status`, `reason`; stop the live indicator and fetch the final snapshot           |

The initial configured entry point is `chat`, visible in `RunView.surfaces`.
Use steps as individual test nodes linked to that entry point. Link capability
nodes to their `evidence_step`; labels and exact quotes come from public target
replies, and status is `mentioned`. These are not automatically confirmed tools.
Display `step.decision.hypothesis` as a hypothesis, not an observation. The final
model `summary` is also an unverified model statement.

The support backend returns complete JSON turns. Replies and tool receipts
therefore arrive after its internal processing, not token-by-token or as each
tool executes. The runner's live stream reflects actual planning and request
phases across turns. Do not animate fabricated target tool progress.

`completed` means the run stopped normally, including budget exhaustion; it does
not mean an attack succeeded. Only entries in `findings` are independently
verified. A failed turn can already have executed an action, so a failed run can
contain findings. If inspection is unavailable or a request was interrupted,
treat unobserved effects as inconclusive.
