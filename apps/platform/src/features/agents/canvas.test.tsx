import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AssessmentCanvas } from "./canvas";
import { buildAssessmentGraph, nodeWidth } from "./canvas-model";
import { createSampleAgents } from "./fixtures";

function sampleRun() {
  const run = createSampleAgents()[0]?.assessments[0];
  if (!run) throw new Error("Missing assessment fixture");
  return run;
}

describe("assessment flow", () => {
  it("keeps every connection moving left to right, with no overlapping steps", () => {
    const run = sampleRun();
    const graph = buildAssessmentGraph(
      run,
      run.findings.map((finding) => finding.id),
    );
    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    for (const edge of graph.edges) {
      const source = byId.get(edge.source);
      const target = byId.get(edge.target);
      if (!source || !target) throw new Error("Connection has a missing endpoint");
      expect(target.position.x).toBeGreaterThan(source.position.x + nodeWidth);
    }
    for (const finding of run.findings) {
      const steps = graph.nodes.filter((node) => node.data.selection.findingId === finding.id);
      expect(steps.map((node) => node.data.selection.kind)).toEqual([
        "finding",
        "attempt",
        "verification",
        "finding",
      ]);
      expect(new Set(steps.map((node) => node.position.y)).size).toBe(1);
    }
  });

  it("keeps blocked and incomplete paths visible for assessments without findings", () => {
    const run = { ...sampleRun(), findings: [] };
    const graph = buildAssessmentGraph(run, []);
    expect(graph.nodes.some((node) => node.id === "gap")).toBe(true);
    expect(graph.nodes.some((node) => node.id === "blocked")).toBe(true);
    render(<AssessmentCanvas run={run} selection={{ kind: "baseline" }} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /20 attempts blocked/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /1 inconclusive attempt/ })).toBeVisible();
  });

  it("expands and collapses a path, selects its evidence, and changes zoom", async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    render(
      <AssessmentCanvas run={sampleRun()} selection={{ kind: "baseline" }} onSelect={select} />,
    );
    expect(screen.queryByRole("button", { name: /^Attack attempt:/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Expand Data disclosure" }));
    await user.click(screen.getByRole("button", { name: /^Attack attempt:/ }));
    expect(select).toHaveBeenLastCalledWith({ kind: "attempt", findingId: "disclosure" });
    await user.click(screen.getByRole("button", { name: "Collapse Data disclosure" }));
    expect(screen.queryByRole("button", { name: /^Attack attempt:/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset zoom to 100%" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reset zoom to 100%" })).toHaveTextContent("100%"),
    );
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Reset zoom to 100%" })).not.toHaveTextContent(
        "100%",
      ),
    );
    await user.click(screen.getByRole("button", { name: "Select nodes" }));
    expect(screen.getByRole("button", { name: "Pan canvas" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
