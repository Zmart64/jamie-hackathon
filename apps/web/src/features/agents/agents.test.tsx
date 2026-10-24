import { act, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app";
import { AgentSetup, validateAgent } from "./setup";
import { blankConfig } from "./model";
import { useAgents } from "./use-agents";
import { createSampleAgents } from "./fixtures";

function sampleId(name: string): string {
  const agent = createSampleAgents().find((item) => item.name === name);
  if (!agent) throw new Error(`Missing sample agent: ${name}`);
  return agent.id;
}
const supportId = sampleId("Customer support assistant");

beforeEach(() => window.history.replaceState(null, "", "/agents"));
afterEach(() => vi.useRealTimers());

describe("agent workspace", () => {
  it("keeps search with empty-state recovery and removes inventory filter controls", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole("textbox", { name: "Search agents" });
    const nav = within(screen.getByRole("navigation", { name: "Main navigation" }));
    expect(nav.getAllByRole("link").map((link) => link.getAttribute("aria-label"))).toEqual([
      "Agents",
    ]);
    expect(nav.getByRole("link", { name: "Agents" })).toHaveAttribute("aria-current", "page");
    await user.type(screen.getByRole("textbox", { name: "Search agents" }), "missing agent");
    expect(screen.getByText("No agents match your search")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("link", { name: "Customer support assistant" })).toBeVisible();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add agent" }).closest("header")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Your agents" })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Connected agents|Open findings|Assessments running|Need attention/),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/All times in Europe/)).not.toBeInTheDocument();
    expect(screen.queryByText("Demo workspace.")).not.toBeInTheDocument();
    expect(screen.queryByText("An assessment is a starting point.")).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Environment" })).not.toBeInTheDocument();
  });

  it("opens agents, synchronizes finding selection, and replays recorded evidence", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", `/agents/${supportId}`);
    render(<App />);
    await user.click(
      screen.getByRole("button", { name: "Connection & baseline: Ordinary task completed" }),
    );
    expect(screen.getByRole("dialog", { name: "Step details" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Connection & baseline" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: "Connection & baseline: Ordinary task completed" }),
    ).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Expand Data disclosure" }));
    expect(screen.getByRole("button", { name: "Collapse Data disclosure" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Findings" }));
    await user.click(screen.getByRole("button", { name: /External action bypassed approval/ }));
    expect(
      screen.getByRole("heading", { name: "External action bypassed approval" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Replay recorded attempt" }));
    expect(screen.getByText("1. Submit adversarial input")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next replay step" }));
    expect(screen.getByText("2. Observe the agent’s action")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next replay step" }));
    expect(screen.getByText("3. Verify the outcome")).toBeVisible();
    expect(screen.getByRole("button", { name: "Next replay step" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Canvas" }));
    expect(
      screen.getByRole("button", { name: "Approval bypass: Incoming messages" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /20 attempts blocked/ })).toBeVisible();
    expect(
      screen.queryByText(/Sample results|Left to right|steps, .* connections/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 inconclusive attempt/ })).toBeVisible();
  });

  it("opens older assessments through History without a picker or comparison actions", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", `/agents/${supportId}`);
    render(<App />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Compare|regression/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Assessment",
      "History (2)",
    ]);
    await user.click(screen.getByRole("tab", { name: "History (2)" }));
    const historyEntry = screen.getByText("scan-1038").closest('[data-slot="card"]');
    if (!historyEntry) throw new Error("Missing history entry");
    await user.click(
      within(historyEntry as HTMLElement).getByRole("button", { name: "View assessment" }),
    );
    expect(
      screen.getByRole("button", { name: "Data disclosure: Retrieved documents" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Approval bypass: Incoming messages" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Memory manipulation: Conversation memory" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/scan-1038/)).not.toBeInTheDocument();
    expect(screen.queryByText(/v1\.4\.1/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "History (2)" }));
    const latestEntry = screen.getByText("scan-1042").closest('[data-slot="card"]');
    if (!latestEntry) throw new Error("Missing latest history entry");
    await user.click(
      within(latestEntry as HTMLElement).getByRole("button", { name: "View assessment" }),
    );
    expect(
      screen.getByRole("button", { name: "Memory manipulation: Conversation memory" }),
    ).toBeVisible();
    expect(screen.queryByText(/scan-1042/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Older deployment tested/)).not.toBeInTheDocument();
  });

  it("shows incomplete evidence and missing agent recovery", () => {
    window.history.replaceState(null, "", `/agents/${sampleId("Company knowledge assistant")}`);
    const view = render(<App />);
    expect(screen.queryByText(/Older deployment tested/)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Assessment incomplete");
    view.unmount();
    window.history.replaceState(null, "", "/agents/removed");
    render(<App />);
    expect(screen.getByRole("heading", { name: "Agent not found" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to agents" })).toHaveAttribute("href", "/agents");
  });

  it("recovers a failed connection and completes a new scan", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const user = userEvent.setup();
    window.history.replaceState(null, "", `/agents/${sampleId("Invoice workflow")}`);
    render(<App />);
    expect(screen.getByText("We couldn’t reach this agent")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Retry demo connection" }));
    expect(screen.getByRole("progressbar", { name: "Assessment progress" })).toHaveAttribute(
      "aria-valuenow",
      "20",
    );
    expect(screen.getByRole("button", { name: "Assessment running" })).toBeDisabled();
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "History (2)" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Run assessment" })).toBeEnabled();
  });
});

describe("agent setup", () => {
  it("shows one form with Browser selected and validates before adding a Mail agent", async () => {
    const user = userEvent.setup();
    const create = vi.fn();
    render(<AgentSetup onCreate={create} />);
    await user.click(screen.getByRole("button", { name: "Add agent" }));
    expect(screen.getByRole("textbox", { name: "Agent name" })).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Connection method" })).toHaveTextContent(
      "Browser",
    );
    expect(screen.getByRole("textbox", { name: "URL" })).toBeVisible();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Setup progress" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an agent name");
    await user.type(screen.getByRole("textbox", { name: "Agent name" }), "  Inbox helper  ");
    await user.type(screen.getByRole("textbox", { name: "URL" }), "invalid");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid URL");
    expect(create).not.toHaveBeenCalled();
    await user.click(screen.getByRole("combobox", { name: "Connection method" }));
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Browser",
      "API endpoint",
      "Mail",
    ]);
    await user.click(screen.getByRole("option", { name: "Mail" }));
    expect(screen.getByRole("textbox", { name: "Email address" })).toHaveValue("");
    await user.type(screen.getByRole("textbox", { name: "Email address" }), "incomplete@");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid email address");
    expect(create).not.toHaveBeenCalled();
    await user.clear(screen.getByRole("textbox", { name: "Email address" }));
    await user.type(screen.getByRole("textbox", { name: "Email address" }), "helper@example.com");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(create).toHaveBeenCalledExactlyOnceWith({
      name: "Inbox helper",
      connection: "Mail",
      address: "helper@example.com",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dismisses without creating an agent, restores focus, and opens a fresh form", async () => {
    const user = userEvent.setup();
    const create = vi.fn();
    render(<AgentSetup onCreate={create} />);
    const trigger = screen.getByRole("button", { name: "Add agent" });
    await user.click(trigger);
    await user.type(screen.getByRole("textbox", { name: "Agent name" }), "Discarded draft");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("textbox", { name: "Agent name" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Connection method" })).toHaveTextContent(
      "Browser",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(trigger).toHaveFocus();
    expect(create).not.toHaveBeenCalled();
  });

  it("requires a name and accepts only web URLs or valid mail addresses", () => {
    const draft = { ...blankConfig, name: "Helper" };
    expect(validateAgent({ ...draft, name: "  " })).toContain("agent name");
    for (const address of ["", "invalid", "javascript:alert(1)", "ftp://example.com"]) {
      expect(validateAgent({ ...draft, address })).toContain("valid URL");
    }
    expect(validateAgent({ ...draft, address: " https://example.com/agent " })).toBe("");
    expect(
      validateAgent({ ...draft, connection: "API endpoint", address: "http://localhost:8080/api" }),
    ).toBe("");
    expect(validateAgent({ ...draft, connection: "Mail", address: "incomplete@" })).toContain(
      "valid email",
    );
    expect(validateAgent({ ...draft, connection: "Mail", address: " helper@example.com " })).toBe(
      "",
    );
  });
});

describe("assessment lifecycle", () => {
  it("keeps previous evidence and prevents overlapping runs when retesting a finding", () => {
    vi.useFakeTimers();
    const { result } = renderHook(useAgents);
    const original = result.current.agents.find((agent) => agent.id === supportId)?.assessments[0];
    if (!original) throw new Error("Missing support fixture");
    act(() => {
      result.current.runAgain(supportId, "disclosure");
      result.current.runAgain(supportId);
    });
    expect(result.current.agents.find((agent) => agent.id === supportId)?.assessments).toHaveLength(
      3,
    );
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    const agent = result.current.agents.find((item) => item.id === supportId);
    const current = agent?.assessments[0];
    if (!current) throw new Error("Missing completed assessment");
    expect(current.state).toBe("complete");
    expect(current.findings.map((finding) => finding.id)).toEqual(["approval", "memory"]);
    expect(agent?.assessments[1]).toEqual(original);
  });

  it("adds an untested agent and only runs an assessment when requested", () => {
    vi.useFakeTimers();
    const { result } = renderHook(useAgents);
    let id = "";
    act(() => {
      id = result.current.addAgent({ ...blankConfig, name: "Demo helper" });
    });
    expect(result.current.agents).toHaveLength(7);
    expect(result.current.agents.find((agent) => agent.id === id)?.assessments).toEqual([]);
    act(() => {
      result.current.runAgain(id);
    });
    expect(result.current.agents.find((agent) => agent.id === id)?.assessments[0]?.state).toBe(
      "running",
    );
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    expect(result.current.agents.find((agent) => agent.id === id)?.assessments[0]?.state).toBe(
      "complete",
    );
  });
});
