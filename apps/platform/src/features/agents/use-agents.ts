import { useEffect, useState } from "react";
import { createSampleAgents } from "./fixtures";
import { type Agent, type AgentConfig, type Assessment } from "./model";
import { advanceDemo } from "./demo";

function newAssessment(): Assessment {
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
    fixedIds: [],
    demo: { startedAt: Date.now(), elapsedMs: 0 },
  };
}
export function useAgents() {
  const [agents, setAgents] = useState(() =>
    createSampleAgents().map((agent) => ({
      ...agent,
      assessments: agent.assessments.map((run) =>
        run.state === "running"
          ? { ...run, stage: 0, demo: { startedAt: Date.now(), elapsedMs: 0 } }
          : run,
      ),
    })),
  );
  const demoRunning = agents.some((agent) => {
    const run = agent.assessments[0];
    return run?.state === "running" && Boolean(run.demo);
  });
  useEffect(() => {
    if (!demoRunning) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setAgents((current) =>
        current.map((agent) => {
          const run = agent.assessments[0];
          if (!run?.demo || run.state !== "running") return agent;
          return { ...agent, assessments: [advanceDemo(run, now), ...agent.assessments.slice(1)] };
        }),
      );
    }, 100);
    return () => window.clearInterval(timer);
  }, [demoRunning]);
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
  function runAgain(id: string) {
    setAgents((current) =>
      current.map((agent) => {
        if (agent.id !== id || agent.assessments[0]?.state === "running") return agent;
        return {
          ...agent,
          assessments: [newAssessment(), ...agent.assessments],
        };
      }),
    );
  }
  return { agents, addAgent, runAgain };
}
export type AgentStore = ReturnType<typeof useAgents>;
