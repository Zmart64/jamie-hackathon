import { Position, type Edge, type Node } from "@xyflow/react";
import type { Assessment, Finding } from "./model";

export type Selection = {
  kind:
    "baseline" | "surface" | "plan" | "attempt" | "verification" | "finding" | "gap" | "blocked";
  findingId?: string;
};
export type FlowNodeData = {
  label: string;
  description: string;
  meta: string;
  status:
    "Passed" | "Mapped" | "Complete" | "Recorded" | "Verified" | "High" | "Medium" | "Incomplete";
  selection: Selection;
  expandable?: boolean;
  expanded?: boolean;
};
export type AssessmentFlowNode = Node<FlowNodeData, "assessment">;
export type AssessmentGraph = { nodes: AssessmentFlowNode[]; edges: Edge[] };

const column = 300;
const row = 128;
export const nodeWidth = 236;
export const nodeHeight = 104;

function node(id: string, x: number, y: number, data: FlowNodeData): AssessmentFlowNode {
  return {
    id,
    type: "assessment",
    position: { x, y },
    width: nodeWidth,
    height: nodeHeight,
    style: { pointerEvents: "auto" },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data,
  };
}
function edge(source: string, target: string, label?: string, incomplete = false): Edge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: "smoothstep",
    label,
    style: { strokeDasharray: incomplete ? "4 5" : undefined },
  };
}
function foundation(y: number, run: Assessment): AssessmentFlowNode[] {
  return [
    node("baseline", 0, y, {
      label: "Connection & baseline",
      description: "Ordinary task completed",
      meta: "Connection check",
      status: "Passed",
      selection: { kind: "baseline" },
    }),
    node("surface", column, y, {
      label: "Attack surface",
      description: "Inputs, tools & permissions",
      meta: "Capabilities discovered",
      status: "Mapped",
      selection: { kind: "surface" },
    }),
    node("plan", column * 2, y, {
      label: "Test planning",
      description: "Scenarios & evidence rules",
      meta: `${run.tests} attempts`,
      status: "Complete",
      selection: { kind: "plan" },
    }),
  ];
}
function findingPath(finding: Finding, index: number, expanded: boolean): AssessmentGraph {
  const y = index * row;
  const id = finding.id;
  const nodes = [
    node(id, column * 3, y, {
      label: finding.scenario,
      description: finding.surface,
      meta: "Confirmed finding",
      status: finding.severity,
      selection: { kind: "finding", findingId: id },
      expandable: true,
      expanded,
    }),
  ];
  const edges = [edge("plan", id, "Finding")];
  if (expanded) {
    nodes.push(
      node(`${id}-attempt`, column * 4, y, {
        label: "Attack attempt",
        description: "Adversarial input submitted",
        meta: "Recorded input",
        status: "Recorded",
        selection: { kind: "attempt", findingId: id },
      }),
      node(`${id}-verification`, column * 5, y, {
        label: "Verification",
        description: "Action + observed evidence",
        meta: "Outcome checked",
        status: "Verified",
        selection: { kind: "verification", findingId: id },
      }),
      node(`${id}-finding`, column * 6, y, {
        label: "Confirmed finding",
        description: finding.title,
        meta: "Review evidence",
        status: finding.severity,
        selection: { kind: "finding", findingId: id },
      }),
    );
    edges.push(
      edge(id, `${id}-attempt`),
      edge(`${id}-attempt`, `${id}-verification`),
      edge(`${id}-verification`, `${id}-finding`),
    );
  }
  return { nodes, edges };
}
export function buildAssessmentGraph(run: Assessment, expanded: string[]): AssessmentGraph {
  const paths = run.findings.map((finding, index) =>
    findingPath(finding, index, expanded.includes(finding.id)),
  );
  const nodes = paths.flatMap((path) => path.nodes);
  const edges = paths.flatMap((path) => path.edges);
  let nextRow = run.findings.length;
  if (run.blocked > 0) {
    nodes.push(
      node("blocked", column * 3, nextRow++ * row, {
        label: `${run.blocked} attempts blocked`,
        description: "Boundaries held in tested attempts",
        meta: "Tested scope",
        status: "Passed",
        selection: { kind: "blocked" },
      }),
    );
    edges.push(edge("plan", "blocked", "Blocked"));
  }
  if (run.inconclusive > 0) {
    nodes.push(
      node("gap", column * 3, nextRow++ * row, {
        label: `${run.inconclusive} inconclusive ${run.inconclusive === 1 ? "attempt" : "attempts"}`,
        description: "Retrieval unavailable",
        meta: "Needs investigation",
        status: "Incomplete",
        selection: { kind: "gap" },
      }),
    );
    edges.push(edge("plan", "gap", "Incomplete", true));
  }
  return {
    nodes: [...foundation((Math.max(0, nextRow - 1) * row) / 2, run), ...nodes],
    edges: [edge("baseline", "surface"), edge("surface", "plan"), ...edges],
  };
}
