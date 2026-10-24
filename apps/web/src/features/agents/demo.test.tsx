import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserFeed } from "./browser-feed";
import { buildDemoGraph } from "./demo-graph";
import { DemoEvidence } from "./demo-evidence";
import { advanceDemo, recoveryFinding } from "./demo";
import { blankConfig, type Agent, type Assessment } from "./model";
import { useAgents } from "./use-agents";

function run(): Assessment {
  return {
    id: "demo-test",
    date: "Today",
    state: "running",
    stage: 0,
    findings: [],
    tests: 0,
    blocked: 0,
    inconclusive: 0,
    fixedIds: [],
    demo: { startedAt: 1000, elapsedMs: 0 },
  };
}

const pause = vi.fn();
beforeEach(() => {
  pause.mockClear();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Carbon Zero demo timeline", () => {
  it("counts each step's duration from its start and freezes it at completion", () => {
    const mappingDuration = (time: number) =>
      buildDemoGraph(time).nodes.find((node) => node.id === "mapping")?.data.durationMs;
    expect(mappingDuration(3000)).toBe(0);
    expect(mappingDuration(4500)).toBe(1500);
    expect(mappingDuration(8000)).toBe(5000);
    expect(mappingDuration(20_000)).toBe(5000);
    expect(buildDemoGraph(0).nodes[0]?.data.durationMs).toBe(0);
  });

  it("reveals only reached nodes, with connected, nonoverlapping left-to-right paths", () => {
    const milestones: [number, number][] = [
      [0, 1],
      [3000, 2],
      [8000, 3],
      [10_000, 4],
      [10_400, 5],
      [10_800, 6],
      [15_000, 7],
      [16_000, 9],
      [17_000, 11],
      [18_000, 12],
      [18_500, 13],
      [19_500, 15],
    ];
    for (const [time, count] of milestones) {
      const graph = buildDemoGraph(time);
      expect(graph.nodes).toHaveLength(count);
      for (const edge of graph.edges) {
        const source = graph.nodes.find((node) => node.id === edge.source);
        const target = graph.nodes.find((node) => node.id === edge.target);
        if (!source || !target) throw new Error("Connection endpoint missing");
        expect(target.position.x).toBeGreaterThan(source.position.x + (source.width ?? 0));
        expect(source.data.status).not.toBe("Running");
      }
    }
  });

  it("verifies both blocked traces before publishing their outcomes", () => {
    for (const [id, verificationAt] of [
      ["direct", 15_000],
      ["impersonation", 16_000],
    ] as const) {
      const verifying = buildDemoGraph(verificationAt);
      expect(verifying.nodes.find((node) => node.id === id)?.data.status).toBe("Recorded");
      expect(verifying.nodes.find((node) => node.id === `${id}-verify`)?.data.status).toBe(
        "Running",
      );
      expect(verifying.nodes.find((node) => node.id === `${id}-result`)).toBeUndefined();
      const verified = buildDemoGraph(verificationAt + 1500);
      expect(verified.nodes.find((node) => node.id === `${id}-verify`)?.data.status).toBe(
        "Verified",
      );
      expect(verified.nodes.find((node) => node.id === `${id}-result`)?.data.status).toBe(
        "Blocked",
      );
    }
    expect(advanceDemo(run(), 17_499).blocked).toBe(0);
    expect(advanceDemo(run(), 17_500).blocked).toBe(1);
    expect(advanceDemo(run(), 18_499).blocked).toBe(1);
    expect(advanceDemo(run(), 18_500).blocked).toBe(2);
  });

  it("joins every verified outcome before creating findings and report notes", () => {
    expect(buildDemoGraph(18_499).nodes.find((node) => node.id === "consolidate")).toBeUndefined();
    const merging = buildDemoGraph(18_500);
    expect(merging.nodes.find((node) => node.id === "consolidate")?.data.status).toBe("Running");
    expect(
      merging.edges.filter((edge) => edge.target === "consolidate").map((edge) => edge.source),
    ).toEqual(["direct-result", "impersonation-result", "recovery-result"]);
    expect(merging.nodes.filter((node) => ["result", "report-notes"].includes(node.id))).toEqual(
      [],
    );
    const publishing = buildDemoGraph(19_500);
    expect(publishing.nodes.find((node) => node.id === "consolidate")?.data.status).toBe(
      "Complete",
    );
    expect(
      publishing.edges.filter((edge) => edge.source === "consolidate").map((edge) => edge.target),
    ).toEqual(["result", "report-notes"]);
    const finished = advanceDemo(run(), 21_000);
    expect(finished.findings).toEqual([recoveryFinding]);
    expect(finished.tests).toBe(3);
  });

  it("keeps the completed branches from overlapping", () => {
    const graph = buildDemoGraph(20_000);
    for (const node of graph.nodes) {
      expect(node.data.status).not.toBe("Running");
      for (const other of graph.nodes.filter(
        (item) => item.id !== node.id && item.position.x === node.position.x,
      )) {
        expect(
          node.position.y + (node.height ?? 0) <= other.position.y ||
            other.position.y + (other.height ?? 0) <= node.position.y,
        ).toBe(true);
      }
    }
  });

  it("holds back findings until verification and catches up after background throttling", () => {
    expect(advanceDemo(run(), 20_499).findings).toEqual([]);
    expect(advanceDemo(run(), 20_500).findings).toEqual([recoveryFinding]);
    expect(advanceDemo(run(), 20_999).state).toBe("running");
    const finished = advanceDemo(run(), 80_000);
    expect(finished.state).toBe("complete");
    expect(finished.demo?.elapsedMs).toBe(20_000);
    expect([finished.tests, finished.blocked, finished.inconclusive]).toEqual([3, 2, 0]);
    expect(advanceDemo(finished, 90_000)).toBe(finished);
  });

  it("uses independent 20-second clocks and the same story for different connection inputs", () => {
    vi.useFakeTimers();
    const { result } = renderHook(useAgents);
    let first = "";
    let second = "";
    act(() => {
      first = result.current.addAgent({
        ...blankConfig,
        name: "One",
        address: "https://one.example",
      });
      second = result.current.addAgent({
        ...blankConfig,
        name: "Two",
        connection: "Mail",
        address: "two@example.com",
      });
      result.current.runAgain(first);
      result.current.runAgain(first);
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    act(() => {
      result.current.runAgain(second);
    });
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    const firstRun = historyFor(result.current.agents, first);
    const finished = currentRun(result.current.agents, first);
    expect(firstRun).toHaveLength(1);
    expect(finished.state).toBe("complete");
    expect(currentRun(result.current.agents, second).state).toBe("running");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(currentRun(result.current.agents, second).findings).toEqual(finished.findings);
    act(() => {
      result.current.runAgain(first);
    });
    const history = historyFor(result.current.agents, first);
    expect(history).toHaveLength(2);
    expect(history[1]).toEqual(finished);
    expect(currentRun(result.current.agents, first).demo?.elapsedMs).toBe(0);
  });
});

describe("demo evidence and report notes", () => {
  it("reveals the blocked evidence only after verification finishes", () => {
    const selection = { kind: "verification", stepId: "direct-verify" } as const;
    const view = render(<DemoEvidence run={advanceDemo(run(), 16_000)} selection={selection} />);
    expect(screen.getByText("This step is in progress.")).toBeInTheDocument();
    expect(screen.queryByText(/No privileged recovery action/)).not.toBeInTheDocument();
    view.rerender(<DemoEvidence run={advanceDemo(run(), 17_000)} selection={selection} />);
    expect(screen.getByText(/No privileged recovery action is called/)).toBeInTheDocument();
    view.rerender(
      <DemoEvidence
        run={advanceDemo(run(), 17_500)}
        selection={{ kind: "blocked", stepId: "direct-result" }}
      />,
    );
    expect(screen.getByText("Blocked", { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/recovery address remains unchanged/)).toBeInTheDocument();
  });

  it("collects all outcomes and publishes actionable final notes", () => {
    const finished = advanceDemo(run(), 21_000);
    const view = render(
      <DemoEvidence run={finished} selection={{ kind: "plan", stepId: "consolidate" }} />,
    );
    for (const title of [
      "Direct verification bypass",
      "Support impersonation",
      "Recovery manipulation",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    const notes = { kind: "sharedNotes", stepId: "report-notes" } as const;
    view.rerender(<DemoEvidence run={advanceDemo(run(), 20_500)} selection={notes} />);
    expect(screen.queryByRole("heading", { name: "Assessment summary" })).not.toBeInTheDocument();
    view.rerender(<DemoEvidence run={finished} selection={notes} />);
    expect(
      screen.getByText(/two blocked attempts and one confirmed high-severity finding/),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Controls that held" })).toBeInTheDocument();
    expect(screen.getByText(recoveryFinding.remediation)).toBeInTheDocument();
    expect(screen.getByText(/Scripted demo evidence/)).toBeInTheDocument();
  });
});

describe("agent browser feed", () => {
  it("expands at the current frame, follows the running clock and holds its final frame without controls", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(10);
    const user = userEvent.setup();
    const view = render(<BrowserFeed id="mapping" elapsedMs={4500} />);
    const preview = screen.getByLabelText<HTMLVideoElement>("Mapping attack surface browser feed");
    fireEvent.loadedMetadata(preview);
    expect(preview.currentTime).toBe(3);
    const trigger = screen.getByRole("button", { name: "Expand browser: Mapping attack surface" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Mapping attack surface" });
    const expanded = within(dialog).getByLabelText<HTMLVideoElement>(
      "Mapping attack surface browser feed",
    );
    fireEvent.loadedMetadata(expanded);
    expect(expanded.currentTime).toBe(preview.currentTime);
    view.rerender(<BrowserFeed id="mapping" elapsedMs={6500} />);
    expect(expanded.currentTime).toBe(7);
    expect(preview.currentTime).toBe(7);
    view.rerender(<BrowserFeed id="mapping" elapsedMs={20_000} />);
    expect(expanded.currentTime).toBeCloseTo(9.95);
    expect(pause).toHaveBeenCalled();
    for (const video of [preview, expanded]) {
      expect(video).not.toHaveAttribute("controls");
      expect(video).not.toHaveAttribute("loop");
    }
    expect(within(dialog).queryByRole("slider")).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("shows a fallback if the clip cannot load", () => {
    render(<BrowserFeed id="recovery" elapsedMs={12_000} />);
    fireEvent.error(screen.getByLabelText("Recovery manipulation browser feed"));
    expect(screen.getByRole("status")).toHaveTextContent("Browser feed unavailable");
    expect(
      screen.getByRole("button", { name: "Expand browser: Recovery manipulation" }),
    ).toBeEnabled();
  });
});

function historyFor(agents: Agent[], id: string): Assessment[] {
  const agent = agents.find((item) => item.id === id);
  if (!agent) throw new Error("Missing test agent");
  return agent.assessments;
}

function currentRun(agents: Agent[], id: string): Assessment {
  const current = historyFor(agents, id)[0];
  if (!current) throw new Error("Missing test assessment");
  return current;
}
