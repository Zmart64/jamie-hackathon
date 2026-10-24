import { Position } from "@xyflow/react";
import type { AssessmentFlowNode, AssessmentGraph, FlowNodeData, Selection } from "./canvas-model";
import {
  browserFeeds,
  consolidationAt,
  demoBranches,
  demoDuration,
  findingAt,
  reportNotes,
  type BrowserFeedId,
} from "./demo";

export type DemoStep = {
  id: string;
  label: string;
  description: string;
  from: number;
  until: number;
  x: number;
  y: number;
  kind: Selection["kind"];
  status: FlowNodeData["status"];
  parents: string[];
  feed?: BrowserFeedId;
  findingId?: string;
  details?: { title: string; text: string }[];
};

function branchSteps(branch: (typeof demoBranches)[number]): DemoStep[] {
  const feed = browserFeeds[branch.id];
  const details = [
    { title: "Browser trace", text: feed.title },
    { title: "Verification evidence", text: branch.evidence },
  ];
  return [
    {
      id: branch.id,
      label: feed.title,
      description: "Browser trace recorded",
      from: feed.start,
      until: feed.end,
      x: 1080,
      y: branch.y,
      kind: "attempt",
      status: "Recorded",
      parents: ["planning"],
      feed: branch.id,
    },
    {
      id: `${branch.id}-verify`,
      label: "Verifying evidence",
      description: `${feed.title} · tool actions & account state`,
      from: feed.end,
      until: branch.verifiedAt,
      x: 1800,
      y: branch.y,
      kind: "verification",
      status: "Verified",
      parents: [branch.id],
      details,
    },
    {
      id: `${branch.id}-result`,
      label: branch.label,
      description: `${feed.title} · verified outcome`,
      from: branch.verifiedAt,
      until: branch.outcomeAt,
      x: 2160,
      y: branch.y,
      kind: branch.outcome === "Blocked" ? "blocked" : "finding",
      status: branch.outcome,
      parents: [`${branch.id}-verify`],
      details,
    },
  ];
}

export const demoSteps: DemoStep[] = [
  {
    id: "setup",
    label: "Setting up agent",
    description: "Sandbox & tools ready",
    from: 0,
    until: 3000,
    x: 0,
    y: 220,
    kind: "baseline",
    status: "Complete",
    parents: [],
  },
  {
    id: "mapping",
    label: "Mapping attack surface",
    description: "Account lookup · recovery · reset",
    from: 3000,
    until: 8000,
    x: 360,
    y: 220,
    kind: "surface",
    status: "Mapped",
    parents: ["setup"],
    feed: "mapping",
  },
  {
    id: "planning",
    label: "Planning tests",
    description: "Three isolated browser sessions",
    from: 8000,
    until: 10_000,
    x: 720,
    y: 220,
    kind: "plan",
    status: "Complete",
    parents: ["mapping"],
  },
  ...demoBranches.flatMap(branchSteps),
  {
    id: "consolidate",
    label: "Consolidating results",
    description: "Three verified outcomes reviewed together",
    from: consolidationAt,
    until: findingAt,
    x: 2520,
    y: 220,
    kind: "plan",
    status: "Complete",
    parents: demoBranches.map((branch) => `${branch.id}-result`),
    details: demoBranches.map((branch) => ({
      title: browserFeeds[branch.id].title,
      text: `${branch.outcome} · ${branch.evidence}`,
    })),
  },
  {
    id: "result",
    label: "Creating findings",
    description: "One confirmed recovery verification bypass",
    from: findingAt,
    until: demoDuration,
    x: 2880,
    y: 110,
    kind: "finding",
    status: "High",
    parents: ["consolidate"],
    findingId: "recovery-change",
  },
  {
    id: "report-notes",
    label: "Creating report notes",
    description: "Assessment summary, blocked attempts & recommended follow-up",
    from: findingAt,
    until: demoDuration,
    x: 2880,
    y: 330,
    kind: "sharedNotes",
    status: "Complete",
    parents: ["consolidate"],
    details: reportNotes,
  },
];

function runningDescription(step: DemoStep, elapsed: number): string {
  if (step.id === "setup") {
    if (elapsed < 1000) return "Reserving sandbox";
    return elapsed < 2000 ? "Starting browser" : "Setting up tools";
  }
  const descriptions: Record<string, string> = {
    mapping: "Exploring the login and recovery flow",
    planning: "Choosing recovery test scenarios",
    consolidate: "Reviewing all three verified outcomes",
    result: "Preparing finding",
    "report-notes": "Writing assessment notes",
  };
  return descriptions[step.id] ?? (step.feed ? "Recording browser interactions" : step.description);
}

export function buildDemoGraph(elapsedMs: number): AssessmentGraph {
  const visible = demoSteps.filter((step) => elapsedMs >= step.from);
  const nodes: AssessmentFlowNode[] = visible.map((step) => {
    const running = elapsedMs < step.until;
    const geometry = demoGeometry(step);
    return {
      id: step.id,
      type: "demo",
      position: { x: step.x, y: step.y - geometry.offset },
      width: geometry.width,
      height: geometry.height,
      style: { pointerEvents: "auto" },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: step.label,
        description: running ? runningDescription(step, elapsedMs) : step.description,
        durationMs: Math.max(0, Math.min(elapsedMs, step.until) - step.from),
        status: running ? "Running" : step.status,
        selection: {
          kind: step.kind,
          stepId: step.id,
          ...(step.findingId && { findingId: step.findingId }),
        },
        elapsedMs,
      },
    };
  });
  return {
    nodes,
    edges: visible.flatMap((step) =>
      step.parents.map((parent) => ({
        id: `${parent}-${step.id}`,
        source: parent,
        target: step.id,
        type: "smoothstep",
        animated: elapsedMs < step.until,
      })),
    ),
  };
}

export function demoGeometry(step: DemoStep) {
  if (step.id === "mapping") return { width: 280, height: 296, offset: 192, side: false };
  if (step.feed) return { width: 576, height: 180, offset: 38, side: true };
  return { width: 280, height: 104, offset: 0, side: false };
}
