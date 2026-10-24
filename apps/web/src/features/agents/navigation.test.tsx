import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "@/app";
import { createSampleAgents } from "./fixtures";

const agentPath = /^\/agents\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

beforeEach(() => window.history.replaceState(null, "", "/agents"));

describe("agent navigation", () => {
  it("uses stable unique UUID links, named breadcrumbs, and browser Back and Forward", async () => {
    const user = userEvent.setup();
    render(<App />);
    const inventory = await screen.findByRole("region", { name: "Agent inventory" });
    const links = within(inventory).getAllByRole("link", { name: /^Open / });
    const paths = links.map((link) => link.getAttribute("href"));
    expect(new Set(paths).size).toBe(6);
    for (const path of paths) expect(path).toMatch(agentPath);
    expect(paths).toEqual(createSampleAgents().map((agent) => `/agents/${agent.id}`));

    const link = screen.getByRole("link", { name: "Customer support assistant" });
    const path = link.getAttribute("href");
    await user.click(link);
    expect(window.location.pathname).toBe(path);
    const breadcrumb = within(screen.getByRole("navigation", { name: "breadcrumb" }));
    expect(breadcrumb.getByRole("link", { name: "Customer support assistant" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("heading", { name: "Customer support assistant", level: 1 }),
    ).toBeVisible();
    expect(screen.queryByRole("tab", { name: "Configuration" })).not.toBeInTheDocument();

    breadcrumb.getByRole("link", { name: "Agents" }).focus();
    await user.keyboard("{Enter}");
    expect(window.location.pathname).toBe("/agents");
    expect(screen.getByRole("heading", { name: "Agents", level: 1 })).toBeVisible();
    act(() => window.history.back());
    await screen.findByRole("heading", { name: "Customer support assistant", level: 1 });
    expect(window.location.pathname).toBe(path);
    act(() => window.history.forward());
    await screen.findByRole("heading", { name: "Agents", level: 1 });
    expect(window.location.pathname).toBe("/agents");
  });

  it("opens a sample UUID directly and restores it after remounting", async () => {
    const agent = createSampleAgents()[0];
    if (!agent) throw new Error("Missing sample agent");
    window.history.replaceState(null, "", `/agents/${agent.id}`);
    const view = render(<App />);
    await screen.findByRole("heading", { name: agent.name, level: 1 });
    view.unmount();
    render(<App />);
    await screen.findByRole("heading", { name: agent.name, level: 1 });
    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toHaveTextContent(agent.name);
    expect(document.title).toContain(agent.name);
  });

  it("keeps a newly added agent when navigating away and back through its UUID link", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Add agent" }));
    await user.type(screen.getByRole("textbox", { name: "Agent name" }), "New helper");
    await user.type(screen.getByRole("textbox", { name: "URL" }), "https://example.com");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByRole("heading", { name: "New helper", level: 1 });
    const path = window.location.pathname;
    expect(path).toMatch(agentPath);
    expect(screen.getByText("Ready for its first assessment")).toBeVisible();
    await user.click(screen.getByRole("link", { name: "Strain home" }));
    expect(window.location.pathname).toBe("/");
    expect(await screen.findByRole("link", { name: "New helper" })).toBeVisible();
    await user.click(screen.getByRole("link", { name: "Agents" }));
    const link = await screen.findByRole("link", { name: "New helper" });
    expect(link).toHaveAttribute("href", path);
    await user.click(link);
    await waitFor(() => expect(window.location.pathname).toBe(path));
    expect(screen.getByRole("heading", { name: "New helper", level: 1 })).toBeVisible();
  });
});
