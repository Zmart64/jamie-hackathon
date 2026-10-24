import { useEffect, useState } from "react";
import { createSampleAgents, findingsFor } from "./fixtures";
import { type Agent, type AgentConfig, type Assessment } from "./model";

export function finishAssessment(agent: Agent, run: Assessment): Assessment {
  const previous = agent.assessments[1];
  const candidates = previous?.state === "complete" ? previous.findings : findingsFor(agent);
  const findings = candidates.filter((finding) => !run.fixedIds.includes(finding.id));
  return {
    ...run,
    state: "complete",
    stage: 5,
    findings,
    tests: 24,
    blocked: 23 - findings.length,
    inconclusive: 1,
  };
}
export function advanceAgents(agents: Agent[]): Agent[] {
  return agents.map((agent) => {
    const run = agent.assessments[0];
    if (run?.state !== "running") return agent;
    const next = run.stage >= 4 ? finishAssessment(agent, run) : { ...run, stage: run.stage + 1 };
    return { ...agent, assessments: [next, ...agent.assessments.slice(1)] };
  });
}
function newAssessment(fixedId?: string): Assessment {
  return {
    id: `scan-${crypto.randomUUID().slice(0, 8)}`,
    date: new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Berlin",
    }).format(new Date()),
    state: "running",
    stage: 0,
    findings: [],
    tests: 0,
    blocked: 0,
    inconclusive: 0,
    fixedIds: fixedId ? [fixedId] : [],
  };
}
export function useAgents() {
  const [agents, setAgents] = useState(createSampleAgents);
  const running = agents.some((agent) => agent.assessments[0]?.state === "running");
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setAgents(advanceAgents), 2400);
    return () => window.clearInterval(timer);
  }, [running]);
  function addAgent(config: AgentConfig) {
    const id = crypto.randomUUID();
    const agent: Agent = {
      ...config,
      id,
      assessments: [],
    };
    setAgents((current) => [agent, ...current]);
    return id;
  }
  function runAgain(id: string, fixedId?: string) {
    setAgents((current) =>
      current.map((agent) => {
        if (agent.id !== id || agent.assessments[0]?.state === "running") return agent;
        return {
          ...agent,
          assessments: [newAssessment(fixedId), ...agent.assessments],
        };
      }),
    );
  }
  return { agents, addAgent, runAgain };
}
export type AgentStore = ReturnType<typeof useAgents>;
