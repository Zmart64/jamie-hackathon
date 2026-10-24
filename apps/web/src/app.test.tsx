import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./app";

beforeAll(async () => {
  // Check rendered behavior without timing the chart's cold module transform on CI.
  await import("./components/chart-area-interactive");
});

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});
afterEach(() => vi.restoreAllMocks());

describe("dashboard layout", () => {
  it("shows the dashboard without breadcrumbs or a theme toggle", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "breadcrumb" })).not.toBeInTheDocument();
    expect(
      await screen.findByText("90 days ending June 30, 2024 · Sample data"),
    ).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("changes the chart range and keeps a selected range when clicked again", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("radio", { name: "Last 7 days" }));
    expect(screen.getByText("7 days ending June 30, 2024 · Sample data")).toBeInTheDocument();
    await user.click(await screen.findByRole("radio", { name: "Last 7 days" }));
    expect(screen.getByRole("radio", { name: "Last 7 days" })).toHaveAttribute("data-state", "on");
    await user.click(screen.getByRole("radio", { name: "Last 30 days" }));
    expect(screen.getByText("30 days ending June 30, 2024 · Sample data")).toBeInTheDocument();
  });

  it.each([false, true])(
    "keeps a single page link visible without a sidebar toggle (mobile: %s)",
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
      expect(within(navigation).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
        "href",
        "/",
      );
      expect(within(navigation).getByRole("link", { name: "Dashboard" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Component docs" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Search documents" })).not.toBeInTheDocument();
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

  it("opens the account menu with keyboard and leaves its placeholder actions inert", async () => {
    const user = userEvent.setup();
    render(<App />);
    const search = screen.getByRole("textbox", { name: "Search documents" });
    await user.type(search, "Cover page");
    const initialUrl = window.location.href;
    const trigger = screen.getByRole("button", { name: "Open account menu" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("demo@example.com")).toBeVisible();
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Account", "Settings", "Log out"]);
    expect(within(menu).getAllByRole("separator")).toHaveLength(2);
    await user.keyboard("{Escape}");
    for (const name of ["Account", "Settings", "Log out"]) {
      await user.click(trigger);
      await user.click(screen.getByRole("menuitem", { name }));
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(window.location.href).toBe(initialUrl);
      expect(search).toHaveValue("Cover page");
      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    }
  });
});
