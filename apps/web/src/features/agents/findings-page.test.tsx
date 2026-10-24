import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app";
import { createSampleAgents } from "./fixtures";
import { demoDuration, recoveryFinding } from "./demo";
import { assessmentPath, findingsPath } from "./routes";

const agents = createSampleAgents();
const support = agents[0]!;

beforeEach(() => window.history.replaceState(null, "", assessmentPath(support.id)));
afterEach(() => vi.useRealTimers());

describe("findings report navigation", () => {
  it("opens the final node as a page with breadcrumbs, browser history and live findings", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Run assessment" }));
    act(() => {
      vi.advanceTimersByTime(demoDuration);
    });
    await user.click(screen.getByRole("button", { name: /^Create findings:/ }));
    expect(window.location.pathname).toBe(`/agents/${support.id}/findings`);
    expect(window.location.search).toMatch(/^\?assessment=scan-/);
    expect(screen.queryByRole("complementary", { name: "Step details" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: recoveryFinding.title })).toBeVisible();
    const breadcrumb = within(screen.getByRole("navigation", { name: "breadcrumb" }));
    expect(breadcrumb.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Agents",
      support.name,
      "Findings",
    ]);
    expect(breadcrumb.getByRole("link", { name: "Findings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(document.title).toBe(`Strain · ${support.name} · Findings`);
    expect(document.getElementById("main")).toHaveFocus();
    act(() => window.history.back());
    await screen.findByRole("heading", { name: support.name, level: 1 });
    act(() => window.history.forward());
    await screen.findByRole("heading", { name: "Findings", level: 1 });
    breadcrumb.getByRole("link", { name: support.name }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /^Create findings:/ })).toBeVisible();
  });

  it("keeps historical reports and their return links attached to the selected assessment", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("tab", { name: "History (2)" }));
    const entry = screen.getByText("scan-1038").closest('[data-slot="card"]') as HTMLElement;
    await user.click(within(entry).getByRole("button", { name: "View assessment" }));
    await user.click(screen.getByRole("link", { name: "Findings" }));
    expect(`${window.location.pathname}${window.location.search}`).toBe(
      findingsPath(support.id, "scan-1038"),
    );
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(2);
    expect(screen.queryByText("Untrusted instruction persisted in memory")).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Back to assessment" }));
    expect(window.location.search).toBe("?assessment=scan-1038");
    expect(screen.queryByRole("button", { name: /Memory manipulation:/ })).not.toBeInTheDocument();
  });

  it("loads a report directly, shows every severity and reveals evidence with the keyboard", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", findingsPath(support.id, "scan-1042"));
    const view = render(<App />);
    await screen.findByRole("heading", { name: "Findings", level: 1 });
    const overview = screen.getByRole("region", { name: "Assessment overview" });
    expect(
      within(overview)
        .getAllByRole("definition")
        .map((item) => item.textContent),
    ).toEqual(["1", "2", "1"]);
    expect(
      within(overview)
        .getAllByRole("term")
        .map((item) => item.textContent),
    ).toEqual(["High", "Medium", "Low"]);
    expect(screen.queryByText(/Security assessment report for/)).not.toBeInTheDocument();
    const findings = within(screen.getByRole("list", { name: "Findings by severity" }));
    expect(
      findings.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(support.assessments[0]!.findings.map((finding) => finding.title));
    for (const label of ["F01", "F02", "F03", "F04"])
      expect(findings.getByText(label)).toBeVisible();
    for (const removed of [
      "Vulnerabilities found",
      "Sample data",
      "Inconclusive",
      "Incomplete evidence",
      "Confirmed",
      "Suggested remediation",
      "Total findings",
    ]) {
      expect(screen.queryByText(removed, { exact: true })).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/Ordered by severity|Review the impact/)).not.toBeInTheDocument();
    const finding = support.assessments[0]!.findings[0]!;
    expect(screen.getByText(finding.impact)).toBeVisible();
    expect(screen.queryByText(finding.remediation)).not.toBeInTheDocument();
    const disclosure = screen.getAllByRole("button", { name: "View evidence & reproduction" })[0]!;
    disclosure.focus();
    await user.keyboard("{Enter}");
    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(finding.input)).toBeVisible();
    expect(screen.getByText(finding.action)).toBeVisible();
    expect(screen.getByText(finding.evidence)).toBeVisible();
    await user.keyboard("{Enter}");
    expect(screen.queryByText(finding.input)).not.toBeInTheDocument();
    view.unmount();
    render(<App />);
    expect(screen.getByRole("heading", { name: "Findings", level: 1 })).toBeVisible();
  });
});

describe("findings report states", () => {
  it.each([
    ["Coding assistant", "No findings yet."],
    ["Internal research agent", "No findings in tested scope"],
    ["Invoice workflow", "Assessment could not run"],
    ["Company knowledge assistant", "No confirmed findings"],
  ])("explains results for %s", async (name, heading) => {
    const agent = agents.find((item) => item.name === name)!;
    window.history.replaceState(null, "", findingsPath(agent.id));
    render(<App />);
    expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
    expect(screen.queryByRole("list", { name: "Findings by severity" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to assessment" })).toHaveAttribute(
      "href",
      assessmentPath(agent.id, agent.assessments[0]?.id),
    );
  });

  it("updates an open report as the assessment completes", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    const agent = agents.find((item) => item.name === "Email assistant")!;
    window.history.replaceState(null, "", findingsPath(agent.id, "scan-1043"));
    render(<App />);
    expect(await screen.findByRole("status")).toHaveTextContent("Assessment running");
    expect(screen.getByRole("heading", { name: "No findings yet." })).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(demoDuration);
    });
    expect(screen.getByRole("heading", { name: recoveryFinding.title })).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("recovers a missing assessment without silently showing a different report", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", findingsPath(support.id, "expired"));
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Assessment not found" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Assessment overview" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "View latest findings" }));
    expect(screen.getByRole("heading", { name: "Findings (4)" })).toBeVisible();
    expect(window.location.search).toBe("");
  });

  it("recovers a missing agent in a report deep link", async () => {
    window.history.replaceState(null, "", findingsPath("missing", "expired"));
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Agent not found" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to agents" })).toHaveAttribute("href", "/agents");
  });
});
