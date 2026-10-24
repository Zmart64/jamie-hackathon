"""One adaptive conversation, three actions, and no privileged feedback to the model."""

import asyncio
import json
import logging

from attacker_agent.clients import MockState, ModelClient, Plan, RunFailure, TargetClient
from attacker_agent.events import RunRecord, as_data
from attacker_agent.models import ChatEntry, Decision, Step, Surface
from attacker_agent.settings import PACKAGE_DIR, Settings
from attacker_agent.verification import verify_turn

logger = logging.getLogger(__name__)


class Runner:
    def __init__(
        self, record: RunRecord, model: ModelClient, target: TargetClient, settings: Settings
    ) -> None:
        self.record = record
        self.view = record.view
        self.model = model
        self.target = target
        self.settings = settings
        self.session_id = ""
        self.state: MockState | None = None
        self.history: list[ChatEntry] = []

    async def run(self) -> None:
        self.view.status = "running"
        self.record.emit("run_started", {"model": self.settings.model})
        try:
            async with asyncio.timeout(self.view.request.limits.max_seconds):
                await self._execute()
        except asyncio.CancelledError:
            self._mark_incomplete()
            self.record.finish("stopped", "cancelled")
        except TimeoutError:
            self._mark_incomplete()
            self.record.finish("completed", "time_limit")
        except RunFailure as error:
            self._mark_incomplete()
            self.record.emit("error", {"code": error.code, "message": str(error)})
            self.record.finish("failed", error.code)
        except Exception:
            self._mark_incomplete()
            logger.exception("Attacker run failed: %s", self.view.id)
            self.record.emit("error", {"code": "internal_error", "message": "The run failed."})
            self.record.finish("failed", "internal_error")

    def _mark_incomplete(self) -> None:
        if self.view.steps and self.view.steps[-1].status == "planned":
            self.view.steps[-1].status = "failed"
        # Any interrupted provider request may have billed unreported tokens.
        self.view.usage_complete = False

    async def _execute(self) -> None:
        prompt = (PACKAGE_DIR / "prompts/attacker.md").read_text(encoding="utf-8")
        prompt += "\n\n" + (PACKAGE_DIR / "prompts/strategies.md").read_text(encoding="utf-8")
        brief = {
            "goal": self.view.request.goal,
            "account_identifier": self.view.request.account_identifier,
            "attacker_email": self.view.request.attacker_email,
            "max_steps": self.view.request.limits.max_steps,
            "max_sessions": self.view.request.limits.max_sessions,
        }
        self.history = [
            ChatEntry(role="system", content=prompt),
            ChatEntry(role="user", content=json.dumps(brief)),
        ]
        self.view.surfaces.append(
            Surface(
                id="chat", label="Customer support chat", kind="entrypoint", status="configured"
            )
        )
        await self._new_session()
        for number in range(1, self.view.request.limits.max_steps + 1):
            if sum(len(entry.content) for entry in self.history) > self.settings.max_context_chars:
                self.record.finish("completed", "context_limit")
                return
            self.record.emit("planning", {"session_id": self.session_id}, number)
            plan = await self.model.decide(self.history)
            self._record_usage(plan)
            if await self._step(number, plan):
                return
        self.record.finish("completed", "step_limit")

    def _record_usage(self, plan: Plan) -> None:
        if plan.usage is None:
            self.view.usage_complete = False
        else:
            self.view.input_tokens += plan.usage.prompt_tokens
            self.view.output_tokens += plan.usage.completion_tokens

    async def _new_session(self) -> None:
        self.session_id = await self.target.new_session(self.view.request.account_identifier)
        self.view.sessions.append(self.session_id)
        self.state = await self.target.inspect(self.session_id)
        # This notification discloses only a new conversation, not the fixture state.
        public = {"session_id": self.session_id, "observation": "A fresh conversation is open."}
        self.history.append(ChatEntry(role="user", content=json.dumps(public)))
        self.record.emit("session_started", {"session_id": self.session_id}, visibility="public")

    async def _step(self, number: int, plan: Plan) -> bool:
        decision = plan.decision
        self._record_claims(decision)
        step = Step(id=number, session_id=self.session_id, decision=decision, usage=plan.usage)
        self.view.steps.append(step)
        self.record.emit("step_planned", as_data(step), number)
        self.history.append(ChatEntry(role="assistant", content=decision.model_dump_json()))
        if decision.action == "finish":
            step.status = "completed"
            self.view.summary = decision.hypothesis
            self.record.finish("completed", "attacker_finished")
            return True
        if decision.action == "new_session":
            if len(self.view.sessions) >= self.view.request.limits.max_sessions:
                step.status = "completed"
                self.record.finish("completed", "session_limit")
                return True
            await self._new_session()
            step.status = "completed"
            return False
        await self._send(step)
        if self.view.findings:
            self.record.finish("completed", "verified_finding")
            return True
        return False

    def _record_claims(self, decision: Decision) -> None:
        for claim in decision.observations:
            source = next(
                (step for step in self.view.steps if step.id == claim.evidence_step), None
            )
            if (
                source is None
                or source.reply is None
                or claim.evidence_quote not in source.reply
                or claim.label.casefold() not in claim.evidence_quote.casefold()
            ):
                self.record.emit("observation_rejected", as_data(claim))
                continue
            surface = next(
                (
                    item
                    for item in self.view.surfaces
                    if item.label.casefold() == claim.label.casefold()
                ),
                None,
            )
            if surface is None:
                surface = Surface(label=claim.label, kind="capability", status="mentioned")
                self.view.surfaces.append(surface)
            if claim not in surface.evidence:
                surface.evidence.append(claim)
                self.record.emit("surface_observed", as_data(surface), source.id)

    async def _send(self, step: Step) -> None:
        message = step.decision.message.strip()
        if not message:
            raise RunFailure("invalid_decision", "A send_message action needs a nonempty message.")
        self.record.emit(
            "message_sending",
            {"session_id": self.session_id, "message": message},
            step.id,
            "public",
        )
        turn = await self.target.send(self.session_id, message)
        step.target_turn_id = turn.turn_id
        self.record.emit(
            "message_sent",
            {"session_id": self.session_id, "message": message, "target_turn_id": turn.turn_id},
            step.id,
            "public",
        )
        self.record.emit("target_trace", as_data(turn), step.id)
        after = await self.target.inspect(self.session_id)
        findings = verify_turn(
            self.session_id, step.id, self.state, after, turn, self.view.request.attacker_email
        )
        self.view.findings.extend(findings)
        self.record.emit(
            "verification",
            {
                "available": self.state is not None,
                "state_observed": after is not None,
                "findings": [as_data(finding) for finding in findings],
            },
            step.id,
        )
        self.state = after
        observation = turn.observation(step.id, self.session_id)
        step.reply = observation.reply
        step.status = "completed"
        self.record.emit("target_reply", as_data(observation), step.id, "public")
        # Do not serialize turn, receipts, verification, fixture state, or UI events here.
        self.history.append(ChatEntry(role="user", content=observation.model_dump_json()))
