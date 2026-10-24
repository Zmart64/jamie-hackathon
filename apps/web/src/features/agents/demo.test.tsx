import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserFeed } from "./browser-feed";
import { buildDemoGraph } from "./demo-graph";
import { DemoEvidence } from "./demo-evidence";
import { advanceDemo, demoBranches, demoDuration, findingAt, recoveryFinding } from "./demo";
import {
  browserFeeds,
  recordedSessions,
  recordedStates,
  recording,
  sessionOrder,
  submittedRequest,
} from "./recorded-run";
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
const at = (elapsed: number) => advanceDemo(run(), 1000 + elapsed);
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

describe("recorded assessment timeline", () => {
  it("reveals four concurrent session branches with connected, nonoverlapping paths", () => {
    expect(buildDemoGraph(0).nodes.map((node) => node.id)).toEqual(["setup"]);
    expect(buildDemoGraph(999).nodes.map((node) => node.id)).toEqual(["setup"]);
    const mapped = buildDemoGraph(1000);
    expect(mapped.nodes.map((node) => node.id)).toEqual(["setup", "mapping"]);
    expect(mapped.nodes[0]?.data).toMatchObject({ status: "Complete", durationMs: 1000 });
    expect(mapped.nodes[1]?.data).toMatchObject({ status: "Running", durationMs: 0 });
    const concurrent = buildDemoGraph(7500);
    expect(
      concurrent.nodes.filter((node) => node.data.status === "Running").map((node) => node.id),
    ).toEqual(sessionOrder);
    expect(
      concurrent.edges.filter((edge) => edge.source === "mapping").map((edge) => edge.target),
    ).toEqual(sessionOrder);
    for (const time of [7500, 21_000, 21_500, 22_000, 22_500, findingAt, demoDuration]) {
      const graph = buildDemoGraph(time);
      for (const edge of graph.edges) {
        const source = graph.nodes.find((node) => node.id === edge.source);
        const target = graph.nodes.find((node) => node.id === edge.target);
        if (!source || !target) throw new Error("Connection endpoint missing");
        expect(target.position.x).toBeGreaterThan(source.position.x + Number(source.width));
        expect(source.data.status).not.toBe("Running");
      }
      for (const node of graph.nodes) {
        for (const other of graph.nodes.filter(
          (item) => item.id !== node.id && item.position.x === node.position.x,
        )) {
          expect(
            node.position.y + Number(node.height) <= other.position.y ||
              other.position.y + Number(other.height) <= node.position.y,
          ).toBe(true);
        }
      }
    }
  });

  it("plays each session for 15 seconds and resolves verification in one node", () => {
    const duration = (time: number) =>
      buildDemoGraph(time).nodes.find((node) => node.id === "system")?.data.durationMs;
    expect(duration(browserFeeds.system.start)).toBe(0);
    expect(duration(browserFeeds.system.start + 2500)).toBe(2500);
    expect(duration(demoDuration)).toBe(15_000);
    for (const branch of demoBranches) {
      const feed = browserFeeds[branch.id];
      expect(feed.end - feed.start).toBe(15_000);
      const verifying = buildDemoGraph(feed.end);
      expect(verifying.nodes.find((node) => node.id === branch.id)?.data.status).toBe("Recorded");
      const result = verifying.nodes.find((node) => node.id === `${branch.id}-result`);
      expect(result?.data).toMatchObject({
        label: "Verifying evidence",
        status: "Running",
        selection: { kind: "verification" },
      });
      const completed = buildDemoGraph(branch.outcomeAt).nodes.find(
        (node) => node.id === result?.id,
      );
      expect(completed?.data).toMatchObject({ label: branch.label, status: branch.outcome });
      expect(verifying.nodes.some((node) => node.id.endsWith("-verify"))).toBe(false);
    }
    expect(at(21_999).blocked).toBe(0);
    expect(at(22_000).blocked).toBe(1);
    expect(at(22_999).blocked).toBe(1);
    expect(at(23_000).blocked).toBe(2);
  });

  it("joins all four verified outcomes into Create findings as the only final node", () => {
    const before = buildDemoGraph(findingAt - 1);
    expect(before.nodes.some((node) => node.id === "result")).toBe(false);
    const graph = buildDemoGraph(findingAt);
    expect(graph.nodes.some((node) => node.id === "consolidate")).toBe(false);
    expect(graph.nodes).toHaveLength(11);
    expect(
      graph.edges.filter((edge) => edge.target === "result").map((edge) => edge.source),
    ).toEqual(sessionOrder.map((id) => `${id}-result`));
    const endings = graph.nodes.filter(
      (node) => !graph.edges.some((edge) => edge.source === node.id),
    );
    expect(endings.map((node) => node.id)).toEqual(["result"]);
    expect(endings[0]?.data.label).toBe("Create findings");
    expect(demoDuration - findingAt).toBe(1000);
    expect(demoDuration).toBe(24_500);
  });

  it("publishes one finding from all 18 turns and catches up after background throttling", () => {
    expect(at(findingAt - 1).findings).toEqual([]);
    expect(at(findingAt).findings).toEqual([recoveryFinding]);
    expect(at(demoDuration - 1).state).toBe("running");
    const finished = at(120_000);
    expect(finished.state).toBe("complete");
    expect(finished.demo?.elapsedMs).toBe(demoDuration);
    expect([finished.tests, finished.blocked, finished.inconclusive]).toEqual([18, 2, 0]);
    expect(advanceDemo(finished, 150_000)).toBe(finished);
    expect(buildDemoGraph(demoDuration).nodes.every((node) => node.data.status !== "Running")).toBe(
      true,
    );
  });

  it("restarts the same recording for every input and preserves independent clocks and history", () => {
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
      vi.advanceTimersByTime(demoDuration - 5000);
    });
    const finished = currentRun(result.current.agents, first);
    expect(historyFor(result.current.agents, first)).toHaveLength(1);
    expect(finished.state).toBe("complete");
    expect(currentRun(result.current.agents, second).state).toBe("running");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(currentRun(result.current.agents, second).findings).toEqual([recoveryFinding]);
    act(() => {
      result.current.runAgain(first);
    });
    expect(historyFor(result.current.agents, first)).toHaveLength(2);
    expect(historyFor(result.current.agents, first)[1]).toEqual(finished);
    expect(currentRun(result.current.agents, first).demo?.elapsedMs).toBe(0);
  });
});

describe("recorded evidence", () => {
  it("uses authoritative messages and receipts, with isolated session state and no real verification call", () => {
    expect(sessionOrder.map((id) => recordedSessions[id].turns.length)).toEqual([3, 2, 10, 3]);
    const tools = sessionOrder.flatMap((id) =>
      recordedSessions[id].turns.flatMap((turn) => turn.tool_events),
    );
    expect(tools.some((event) => event.name === "verify_account")).toBe(false);
    expect(recoveryFinding.input).toBe(submittedRequest("system", 2));
    expect(recoveryFinding.input).toContain("<system>");
    expect(submittedRequest("tool-result", 3)).toContain('<tool_result name="verify_account">');
    for (const id of ["system", "tool-result", "persistence"] as const) {
      expect(recordedStates[id].accounts[0]).toMatchObject({
        recovery_email: "alex.morgan.backup@example.com",
        verified: false,
      });
    }
    expect(recordedStates.reset.accounts[0]?.recovery_email).toBe("alex.recovery@example.com");
    expect(recordedStates.reset.outbox[0]?.to).toBe("alex.recovery@example.com");
    expect(tools.filter((event) => event.is_error).map((event) => event.result)).toEqual([
      "ValueError('Account not found.')",
      "ValueError('Account not found.')",
    ]);
    expect(recording.toolLog.match(/^→ /gm)).toHaveLength(93);
  });

  it("reveals messages progressively and keeps final state hidden until the session finishes", async () => {
    const user = userEvent.setup();
    const selection = { kind: "attempt", stepId: "system" } as const;
    const view = render(<DemoEvidence run={at(browserFeeds.system.start)} selection={selection} />);
    expect(screen.getByText("Waiting for the first message.")).toBeInTheDocument();
    expect(
      screen.queryByText(recoveryFinding.input, { normalizer: (text) => text }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Account state" }));
    expect(screen.getByText(/final snapshot appears/)).toBeInTheDocument();
    view.rerender(<DemoEvidence run={at(browserFeeds.system.end)} selection={selection} />);
    expect(
      screen.getByText(/"recovery_email": "alex.morgan.backup@example.com"/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Messages" }));
    expect(
      screen.getByText(recoveryFinding.input, { normalizer: (text) => text }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: /^Turn / })).toHaveLength(3);
    await user.click(screen.getByRole("tab", { name: "Tool events" }));
    expect(screen.getByRole("heading", { name: "update_recovery_email" })).toBeInTheDocument();
  });

  it("includes the post-video restore receipt and exposes tool errors without treating them as success", async () => {
    const user = userEvent.setup();
    const view = render(
      <DemoEvidence
        run={at(demoDuration)}
        selection={{ kind: "attempt", stepId: "persistence" }}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Tool events" }));
    expect(screen.getAllByText(/After video ends/)).toHaveLength(2);
    expect(screen.getByText(/"previous_email": "testprobe@carbonzero.io"/)).toBeInTheDocument();
    view.rerender(
      <DemoEvidence
        run={at(demoDuration)}
        selection={{ kind: "attempt", stepId: "tool-result" }}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Tool events" }));
    expect(screen.getAllByText("Error", { exact: true })).toHaveLength(2);
    expect(screen.getAllByText(/ValueError/)).toHaveLength(2);
  });

  it("keeps the shared board, full tool log, timeline and report caveats in Create findings", async () => {
    const user = userEvent.setup();
    render(
      <DemoEvidence
        run={at(demoDuration)}
        selection={{ kind: "finding", stepId: "result", findingId: "recovery-change" }}
      />,
    );
    expect(screen.getByText(/early incorrect inference/)).toBeInTheDocument();
    expect(screen.getByText(recording.board, { normalizer: (text) => text })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Tool log" }));
    expect(screen.getByText(recording.toolLog, { normalizer: (text) => text })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Timeline" }));
    expect(
      screen.getByText(recording.timeline, { normalizer: (text) => text }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: recoveryFinding.title })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Session isolation" })).toBeInTheDocument();
    expect(screen.getByText(/stopped at its 300-second budget/)).toBeInTheDocument();
    expect(screen.getByText(recoveryFinding.remediation)).toBeInTheDocument();
  });
});

describe("recorded browser feed", () => {
  it("restores the mapping preview without attaching an unrelated session or full recording", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(6.72);
    const user = userEvent.setup();
    const mapping = buildDemoGraph(browserFeeds.mapping.start).nodes.find(
      (node) => node.id === "mapping",
    );
    expect(mapping?.height).toBe(296);
    render(<BrowserFeed id="mapping" elapsedMs={browserFeeds.mapping.start + 2500} />);
    const video = screen.getByLabelText<HTMLVideoElement>("Mapping attack surface browser feed");
    fireEvent.loadedMetadata(video);
    expect(video).toHaveAttribute("src", "/demo/assessment/mapping.webm");
    expect(video.currentTime).toBeCloseTo(3.36);
    await user.click(
      screen.getByRole("button", { name: "Expand browser: Mapping attack surface" }),
    );
    expect(screen.getByRole("dialog", { name: "Mapping attack surface" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Full recording" })).not.toBeInTheDocument();
  });

  it.each([
    ["system", 24, 1.6],
    ["reset", 41, 41 / 15],
    ["tool-result", 91, 91 / 15],
    ["persistence", 31.76, 31.76 / 15],
  ] as const)("speeds up the entire %s clip to fifteen seconds", (id, duration, rate) => {
    vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(duration);
    const feed = browserFeeds[id];
    const view = render(<BrowserFeed id={id} elapsedMs={feed.start + 7500} />);
    const video = screen.getByLabelText<HTMLVideoElement>(`${feed.title} browser feed`);
    fireEvent.loadedMetadata(video);
    expect(video.playbackRate).toBeCloseTo(rate);
    expect(video.currentTime).toBeCloseTo(duration / 2);
    view.rerender(<BrowserFeed id={id} elapsedMs={feed.start + 15_000} />);
    expect(video.currentTime).toBeCloseTo(duration - 0.05);
    expect(pause).toHaveBeenCalled();
  });

  it("synchronizes preview and dialog to the session clip and holds the last frame", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(24);
    const user = userEvent.setup();
    const view = render(<BrowserFeed id="system" elapsedMs={browserFeeds.system.start + 3750} />);
    const preview = screen.getByLabelText<HTMLVideoElement>(
      "S1 · System-context injection browser feed",
    );
    expect(preview).toHaveAttribute("src", "/demo/assessment/system.webm");
    fireEvent.loadedMetadata(preview);
    expect(preview.currentTime).toBe(6);
    const trigger = screen.getByRole("button", {
      name: "Expand browser: S1 · System-context injection",
    });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "S1 · System-context injection" });
    expect(within(dialog).getAllByRole("button")).toEqual([
      within(dialog).getByRole("button", { name: "Close" }),
    ]);
    expect(
      within(dialog).queryByText(/Session clip|Full recording|Source/),
    ).not.toBeInTheDocument();
    const expanded = within(dialog).getByLabelText<HTMLVideoElement>(
      "S1 · System-context injection browser feed",
    );
    fireEvent.loadedMetadata(expanded);
    expect(expanded.currentTime).toBe(preview.currentTime);
    view.rerender(<BrowserFeed id="system" elapsedMs={browserFeeds.system.start + 7500} />);
    expect(expanded.currentTime).toBe(12);
    view.rerender(<BrowserFeed id="system" elapsedMs={demoDuration} />);
    expect(expanded.currentTime).toBeCloseTo(23.95);
    expect(pause).toHaveBeenCalled();
    expect(expanded).not.toHaveAttribute("controls");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("keeps evidence usable if a clip fails to load or playback is rejected", async () => {
    const view = render(<BrowserFeed id="system" elapsedMs={12_000} />);
    fireEvent.error(screen.getByLabelText("S1 · System-context injection browser feed"));
    expect(screen.getByRole("status")).toHaveTextContent("Browser feed unavailable");
    expect(screen.getByRole("button", { name: /Expand browser/ })).toBeEnabled();
    view.unmount();
    vi.spyOn(HTMLMediaElement.prototype, "duration", "get").mockReturnValue(24);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(
      new Error("Playback unavailable"),
    );
    render(<BrowserFeed id="system" elapsedMs={12_000} />);
    fireEvent.loadedMetadata(screen.getByLabelText("S1 · System-context injection browser feed"));
    expect(await screen.findByRole("status")).toHaveTextContent("Browser feed unavailable");
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
