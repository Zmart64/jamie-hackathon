# Jamie Hackathon

Our team’s project for the [Agentic AI Hack by Jamie](https://luma.com/jamie-hack)
in Berlin on **24 October 2026**.

We’re building our AI agent prototype here, from the first experiments to our
hackathon demo.

## Support agent backend

The [support agent](apps/support-agent/README.md) is a Claude-powered chat API with
mock account recovery tools. It includes configurable model settings, a separate
English system prompt, isolated demo sessions, and tool traces for the frontend.
Run `make support-agent` after setup and adding an Anthropic API key; see its README
for configuration and the frontend contract.

## Local apps

- `make dev` starts the dashboard in `apps/web` on Vite's default port (5173).
- `make dev-demo` starts the Carbon Zero login demo in `apps/demo` at
  <http://127.0.0.1:5174>. Both apps can run at the same time.
- `make check` runs lint, type checks, tests and production builds for both apps.

The Carbon Zero demo accepts a valid email, then reveals the password field.
Every nonempty password is rejected after a short simulated wait, and Sprout
opens a support chat. The forgot links also open Sprout. Two welcome messages
stream into the chat; subsequent user messages are displayed without automated
replies. No account actions or emails are sent, and nothing is transmitted or persisted. Refresh
to reset the demo. This app intentionally stays white in light and dark OS modes.
Sprout is always available in the bottom-right corner; opening or closing its
chat panel does not move the centered login form. Minimizing preserves the
conversation and unsent draft; changing the login email starts a fresh conversation.

## The hackathon

- **Organizers:** Jamie and {Tech: Europe}
- **Technology partners:** Reson8 and Anthropic
- **Challenge:** Build an AI agent in eight hours
- **Location:** Berlin, Germany

The event brings together engineers, founders, and other builders for a day of
prototyping, followed by live demos and awards.

See the [event page](https://luma.com/jamie-hack) for the schedule and venue details.

## Local backends

Run `make setup` once. Start the [customer-support agent](apps/support-agent/README.md)
with `make support-agent` (port 8000), and the
[black-box attacker](apps/attacker-agent/README.md) with `make attacker-agent` (port 8001).
Each service has its own ignored `.env` file and API key. The attack UI can use
the attacker's [run and event contract](apps/attacker-agent/API.md).
