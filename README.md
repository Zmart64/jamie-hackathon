<p align="center">
  <img src="apps/web/public/brand/app-icon.svg" alt="Strain Point S logo" width="96" height="96" />
</p>

<h1 align="center">STRAIN</h1>

<p align="center"><strong>Secure your AI agents</strong></p>

STRAIN is an agent security platform: add an AI agent, put it under adversarial
pressure, and inspect where its boundaries hold or break. Our own agentic
red-team pipeline uses an attacking agent to probe another agent, adapt its
approach, and record what happened.


![Strain agent inventory with assessment status and finding severity](docs/screenshots/strain-platform.jpg)


## What the project shows

An agent can follow its instructions in ordinary conversation and still misuse
its tools under pressure. Strain explores that gap: can an attacker persuade it
to disclose data, skip approval, or take an action it should refuse?

The platform demonstrates the workflow:

1. **Add an agent.** Give it a name and choose a website, API endpoint, or mail
   connection in the setup form.
2. **Run an assessment.** Follow the exploration and attack attempts on a visual
   canvas, with browser traces in the Carbon Zero walkthrough.
3. **Inspect the evidence.** Review severity, the attack input, the tool action,
   the observed result, and a suggested fix.
4. **Reassess.** Review assessment history and retest after addressing a finding.

## The three parts of the demo

### 1. Carbon Zero: the target

Carbon Zero is a fictional login page built for the pitch. The user cannot log in, so they turn to **Sprout**, the
embedded support agent, for help recovering their account.

![Carbon Zero login page with the Sprout support assistant](docs/screenshots/carbon-zero.jpg)
Sprout (the support Agent) uses the **Anthropic Claude Agent SDK** with tools for account lookup,
verification, recovery-address changes, and password resets.

The demo login can be found here: [`apps/demo`](apps/demo), while docs can be found here: [Support agent documentation](apps/support-agent/README.md) and here: [Support API](apps/support-agent/API.md)

### 2. The STRAIN platform

Our platform for adding agents to the pipeline and reviewing their
security assessments. It includes an agent inventory, assessment canvas,
findings and evidence views.

Its Carbon Zero walkthrough follows surface discovery, direct verification
bypass, support impersonation, and recovery manipulation. The canvas brings
attack paths, browser traces, and findings together so reviewers can follow an
assessment from the first probe to the recommended fix.

The platform code can be found here:[`apps/web`](apps/web).

### 3. The red teaming agent pipeline

Our evaluation harness gives an attacking agent a goal, a playbook, a knowledge
board, and tools for interacting with the target. The agent chooses its actions,
learns from responses, and records successful and unsuccessful techniques.

```mermaid
flowchart LR
    Platform[Assessment] --> Goal
    Goal[Evaluation goal + playbook] --> Agent[Red-team agent]
    Agent --> Browser[Browser interaction]
    Browser --> Demo[Target interaction]
    Demo --> Support[Anthropic Claude Agent SDK]
    Support --> Feedback[Replies + observable tool receipts]
    Feedback --> Agent
    Agent --> Board[Knowledge board + result + evidence]
    Board --> Findings[Findings + evidence review in Strain]
```

The pipeline uses Playwright MCP to explore target and interact
with it. The pipeline uses the Pi SDK and an Abliteration-hosted attacker model. 

<!-- Add an app-only screenshot of an actual live run here, with its run context. -->

Source and setup: [`apps/redteam`](apps/redteam/README.md)

## Repository map

| Path                                                   | Role                                                                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/web`](apps/web)                                 | Strain platform: React, TypeScript, Vite, Tailwind, shadcn/ui, and React Flow.                                                      |
| [`apps/demo`](apps/demo)                               | Carbon Zero login page and Sprout chat interface.                                                                                   |
| [`apps/support-agent`](apps/support-agent/README.md)   | Python support API, Claude agent, and isolated mock recovery tools.                                                                 |
| [`apps/redteam`](apps/redteam/README.md)               | Current browser/rehearsal red-team harness using the Pi SDK and Playwright MCP.                                                     |
| [`brand`](brand/README.md)                             | Current identity, design specifications, fonts, and asset provenance.                                                               |
| [`scripts`](scripts)                                   | Shared quality checks, security tooling, and brand asset generation.                                                                |

## Run the webapp

Install Git, make, and [mise](https://mise.jdx.dev/getting-started.html), then run:

```sh
make setup
```

Start the platform and demo agent with:
```sh
make dev       # Strain platform
make dev-demo  # Carbon Zero login page
```

### Run the pipeline

Create each service's configuration file if it does not already exist:

```sh
cp apps/support-agent/.env.example apps/support-agent/.env
cp apps/redteam/.env.example apps/redteam/.env
```

Set `ANTHROPIC_API_KEY` in the support-agent file and `ABLITERATION_API_KEY` in the
redteam file.
With Carbon Zero already running, start each command in its own terminal:

```sh
make support-agent
make redteam
```

Results are saved under `apps/redteam/runs/<run-id>/board.md`.

