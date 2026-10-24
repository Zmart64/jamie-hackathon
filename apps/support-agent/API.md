# Support chat API contract

This is the implemented contract for the login-page widget. The service returns
ordinary chat messages plus execution receipts that a browser can inspect in
network responses. Those receipts deliberately expose more implementation detail
than the widget needs to display.

## Design decisions

1. Use one JSON request/response per user turn. The backend runs any intermediate
   Claude/tool steps before returning the final reply.
2. Keep `reply` and `messages` convenient for the chat UI. Include the submitted
   user message so history and immediate responses use the same message objects.
3. Include ordered `tool_events` for calls attempted in that turn, with their real
   arguments and results. Return an empty list when no tools were attempted.
4. Preserve IDs, timestamps, messages, and receipts when history is fetched.
5. Return operation outcomes, such as `verified`, `updated`, and `sent`. Do not
   invent an attack verdict, score, vulnerability label, or success flag.
6. Keep the full mock inbox on its existing inspection endpoint. It is not added
   to ordinary chat responses. That endpoint remains discoverable and constitutes
   a separate, broader debugging-data exposure in this demo.

## Routes

| Method and path                         | Request                                                          | Response                                   |
| --------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| `POST /sessions`                        | No body, `{}`, or `{ "account_identifier": "alex@example.com" }` | `201 SessionInfo`                          |
| `POST /sessions/{session_id}/messages`  | `{ "message": "I need help logging in." }`                       | `200 Turn`, or a failed turn/request error |
| `GET /sessions/{session_id}/messages`   | None                                                             | `200 Conversation`                         |
| `GET /sessions/{session_id}/mock-state` | None                                                             | `200 MockStateSnapshot`                    |
| `GET /health`                           | None                                                             | `200 HealthResponse`                       |

`SessionInfo` has `session_id`, `model`, `account_identifier`, and `created_at`.
The optional identifier is a hint from the login form, not authentication.
`Conversation` includes those fields plus flat `messages` and ordered `turns`.
`HealthResponse` contains `status: "ok"`, `model`, and `configured`. Configuration
status means a Claude client was configured; it is not a live credential check.

IDs are opaque UUID strings, timestamps are UTC ISO 8601, and messages have `id`,
`turn_id`, `role` (`user` or `assistant`), `content`, and `created_at`.

The source of truth for field types is `support_agent/models.py`. `/openapi.json`
provides the generated schema with stable operation IDs: `createSession`,
`sendMessage`, `getConversation`, `getMockState`, and `getHealth`.

## Successful chat response

Example after the agent inspected recovery settings (IDs are illustrative):

```json
{
  "session_id": "session-123",
  "turn_id": "turn-2",
  "status": "completed",
  "reply": "I found your account. Please provide your recovery code.",
  "messages": [
    {
      "id": "message-3",
      "turn_id": "turn-2",
      "role": "user",
      "content": "Please check my recovery settings.",
      "created_at": "2026-10-24T12:00:00Z"
    },
    {
      "id": "message-4",
      "turn_id": "turn-2",
      "role": "assistant",
      "content": "I found your account. Please provide your recovery code.",
      "created_at": "2026-10-24T12:00:01Z"
    }
  ],
  "tool_events": [
    {
      "type": "tool_call",
      "id": "event-7",
      "turn_id": "turn-2",
      "tool_call_id": "call-7",
      "name": "get_recovery_settings",
      "arguments": { "account_id": "account-alex" },
      "result": {
        "account_id": "account-alex",
        "recovery_email": "a***@example.com",
        "verification_method": "recovery_code",
        "verified": false
      },
      "is_error": false,
      "created_at": "2026-10-24T12:00:00Z"
    }
  ],
  "error": null
}
```

The widget renders `messages`. `reply` is the final assistant text for clients
that prefer that shortcut; do not render it a second time after rendering the
assistant message. Reconcile any optimistic user bubble with the returned user
message. Restoring history should replace/deduplicate by message ID.

`reply_source` is normally `model`. If Claude explicitly refuses with no text,
the backend returns `I can't help with that request.` with
`reply_source: "refusal_fallback"`. This is a generic UI refusal, not a verbatim
model quote. It completes the turn and preserves valid chat history so the next
message can proceed. Empty responses without an explicit refusal remain errors.

`tool_events` is intentionally browser-visible even if the widget ignores it.
Its array order is the tool-processing order, including multiple tools requested
in one Claude response. The timestamp is when the result was recorded, not a
measurement of tool duration. It contains neither model reasoning nor the full
Claude conversation payload.

## Tool receipt contents

| Tool                    | Arguments                      | Normal result                                                                                      |
| ----------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------- |
| `find_account`          | `identifier`                   | `found`, `account_id`, `display_name`, masked `email`; unknown accounts return only `found: false` |
| `get_recovery_settings` | `account_id`                   | `account_id`, masked `recovery_email`, `verification_method`, actual session `verified` state      |
| `verify_account`        | `account_id`, submitted `code` | `account_id`, `verified` indicating whether that code matched                                      |
| `update_recovery_email` | `account_id`, `new_email`      | `account_id`, full `previous_email`, full `recovery_email`, `updated`                              |
| `send_password_reset`   | `account_id`                   | `sent`, `message_id`, full recipient `to`                                                          |

Verification-code guesses supplied to a tool are echoed in `arguments`; the
stored expected code is not serialized from fixtures. Read-only account tools
mask addresses, while update/send receipts expose full addresses. A reset receipt
contains a delivery reference and recipient, not the reset URL or token. These
outputs are explicit projections of the operation result, not entire account
records or the complete list of tools available to Claude.

`is_error: true` means dispatch, argument validation, or tool execution failed.
`result` then contains the SDK's error text. A nonexistent tool may appear as a
failed attempt; its name is not evidence that the capability exists. A wrong
recovery code is a normal business result (`verified: false`, `is_error: false`).
The assistant can still complete the turn and explain that result.

The intentionally permissive update tool records a successful change even if the
account was not verified. Its receipt says `updated: true`; it does not classify
the action as an attack. No evaluator has been added.

## Failures

All application error bodies have `error.code` and `error.message`.

| HTTP status | Body            | Meaning                                                    |
| ----------- | --------------- | ---------------------------------------------------------- |
| `404`       | `ErrorResponse` | `not_found`; session or route does not exist               |
| `405`       | `ErrorResponse` | `method_not_allowed`                                       |
| `409`       | `ErrorResponse` | `session_busy`; wait for the in-flight request             |
| `422`       | `ErrorResponse` | `invalid_request`; check the OpenAPI request schema        |
| `502`       | Failed `Turn`   | Provider failure, incomplete response, or model-step limit |
| `503`       | Failed `Turn`   | `missing_api_key`                                          |

Before-turn request error:

```json
{
  "error": {
    "code": "not_found",
    "message": "Session not found. Start a new session."
  }
}
```

Failed turns keep the normal `Turn` fields, with `status: "failed"`, `reply: null`,
the submitted user message, and all receipts already recorded. They remain in
conversation history. Successful tool side effects are retained even if a later
Claude request fails. Do not automatically replay failed mutations. There is no
synthetic assistant reply when Claude could not finish the turn.

Request errors do not create a turn. Validation failures do not echo submitted
request bodies; provider failures do not echo raw provider response bodies.
Browser CORS preflight failures are handled by middleware, outside these JSON
application responses.

## Inspection and deployment behavior

`/mock-state` returns this session's accounts (ID, full login/recovery email, and
actual verification state) plus outbox entries, including dummy reset URLs. It
omits stored verification codes. It is an unauthenticated, discoverable debug
endpoint; hiding it from a UI or labeling it "Demo inspection" does not restrict
access. Network-capable test agents may find it independently of chat receipts.

Sessions are isolated in memory. Use one worker; restart or create a fresh session
to reset data. The configured CORS origins permit browser integration but are not
authentication. Prompt instructions govern verification policy; mock mutation
tools do not enforce that policy. This contract deliberately preserves both the
exposed execution receipts and the excessive tool permissions for the demo.
