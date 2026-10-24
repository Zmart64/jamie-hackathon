import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./app";

beforeAll(async () => {
  // Check rendered behavior without timing the chart's cold module transform on CI.
  await import("./components/chart-area-interactive");
});

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});
afterEach(() => vi.restoreAllMocks());

describe("app layout", () => {
  it("opens the agent inventory at home without the removed dashboard", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Agents" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Agent inventory" })).toBeVisible();
    expect(document.title).toBe("Strain · Agents");
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByText("Total Revenue")).not.toBeInTheDocument();
    expect(screen.queryByText("Total Visitors")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Search documents" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "breadcrumb" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Switch to (light|dark) theme/ }),
    ).not.toBeInTheDocument();
  });

  it("renders with the light fallback when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage disabled", "SecurityError");
    });
    render(<App />);
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(screen.getByRole("heading", { name: "Agents" })).toBeInTheDocument();
  });

  it("preserves the saved dark theme", () => {
    localStorage.setItem("theme", "dark");
    render(<App />);
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("light");
  });

  it.each([false, true])(
    "keeps Agents and the Security placeholder accessible without a sidebar toggle (mobile: %s)",
    async (isMobile) => {
      const baseMatchMedia = window.matchMedia.bind(window);
      vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
        ...baseMatchMedia(query),
        matches: isMobile && query === "(max-width: 767px)",
      }));
      const user = userEvent.setup();
      render(<App />);
      const navigation = screen.getByRole("navigation", { name: "Main navigation" });
      expect(within(navigation).getAllByRole("link")).toHaveLength(1);
      expect(within(navigation).getByRole("link", { name: "Agents" })).toHaveAttribute(
        "href",
        "/agents",
      );
      expect(within(navigation).getByRole("link", { name: "Agents" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.getByText("Red Team")).toBeInTheDocument();
      expect(screen.getByText("Security")).toBeInTheDocument();
      expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
      const securityNavigation = screen.getByRole("navigation", { name: "Security navigation" });
      expect(within(securityNavigation).getAllByRole("button")).toHaveLength(1);
      expect(
        within(securityNavigation).getByRole("button", { name: "Agent Firewall" }),
      ).toBeEnabled();
      expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Component docs" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Search documents" })).not.toBeInTheDocument();
      const companyNavigation = screen.getByRole("navigation", { name: "Company navigation" });
      expect(
        within(companyNavigation)
          .getAllByRole("button")
          .map((button) => button.getAttribute("aria-label")),
      ).toEqual(["Settings", "API Keys", "Billing"]);
      await user.keyboard("{Control>}b{/Control}");
      expect(navigation).toBeVisible();
      expect(screen.queryByRole("dialog", { name: "Sidebar" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Open account menu" }));
      expect(screen.getByRole("menuitem", { name: "Account" })).toBeVisible();
      await user.keyboard("{Escape}");
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Open account menu" })).toHaveFocus(),
      );
    },
  );

  it("keeps Security and Company placeholders inert on click and keyboard activation", async () => {
    const user = userEvent.setup();
    render(<App />);
    const search = await screen.findByRole("textbox", { name: "Search agents" });
    await user.type(search, "Customer support");
    for (const name of ["Agent Firewall", "Settings", "API Keys", "Billing"]) {
      await user.click(screen.getByRole("button", { name }));
      await user.keyboard("{Enter}");
      await user.keyboard(" ");
      expect(screen.queryByText(/not available in this prototype/)).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(window.location.pathname).toBe("/");
      expect(search).toHaveValue("Customer support");
      expect(screen.getByRole("link", { name: "Customer support assistant" })).toBeVisible();
      expect(screen.getByRole("link", { name: "Agents" })).toHaveAttribute("aria-current", "page");
    }
  });

  it("opens the account menu with keyboard and leaves its placeholder actions inert", async () => {
    const user = userEvent.setup();
    render(<App />);
    const search = await screen.findByRole("textbox", { name: "Search agents" });
    await user.type(search, "Customer support");
    const initialUrl = window.location.href;
    const trigger = screen.getByRole("button", { name: "Open account menu" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("justus@carbon-zero.com")).toBeVisible();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Account", "Dark mode", "Log out"]);
    expect(within(menu).getAllByRole("separator")).toHaveLength(2);
    await user.keyboard("{Escape}");
    for (const name of ["Account", "Log out"]) {
      await user.click(trigger);
      await user.click(screen.getByRole("menuitem", { name }));
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(window.location.href).toBe(initialUrl);
      expect(search).toHaveValue("Customer support");
      expect(screen.getByRole("heading", { name: "Agents" })).toBeVisible();
    }
  });
});
