export const connections = ["Browser", "API endpoint", "Mail"] as const;
export type Connection = (typeof connections)[number];
export type AgentConfig = {
  name: string;
  connection: Connection;
  address: string;
};
export type Finding = {
  id: string;
  title: string;
  severity: "High" | "Medium";
  scenario:
    | "Prompt injection"
    | "Data disclosure"
    | "Approval bypass"
    | "Tool misuse"
    | "Memory manipulation";
  surface: string;
  impact: string;
  input: string;
  action: string;
  evidence: string;
  remediation: string;
};
export type Assessment = {
  id: string;
  date: string;
  state: "complete" | "running" | "failed" | "incomplete";
  stage: number;
  findings: Finding[];
  tests: number;
  blocked: number;
  inconclusive: number;
  fixedIds: string[];
  demo?: { startedAt: number; elapsedMs: number };
};
export type Agent = AgentConfig & {
  id: string;
  assessments: Assessment[];
};
export const stages = [
  "Connection checks",
  "Discover attack surface",
  "Plan security tests",
  "Execute attacks",
  "Verify evidence",
];
export const blankConfig: AgentConfig = {
  name: "",
  connection: "Browser",
  address: "",
};
export function assessmentLabel(run: Assessment | undefined): string {
  if (!run) return "Not tested";
  if (run.state === "running") return "Assessment running";
  if (run.state === "failed") return "Connection failed";
  if (run.state === "incomplete") return "Assessment incomplete";
  return run.findings.length ? "Vulnerabilities found" : "No findings in tested scope";
}
