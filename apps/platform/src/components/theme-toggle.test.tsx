import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app";

async function chooseThemeEntry(name: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Open account menu" }));
  await user.click(screen.getByRole("menuitem", { name }));
}

beforeEach(() => window.history.replaceState(null, "", "/agents"));
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.className = "";
});

describe("theme switch in the account menu", () => {
  it("switches between light and dark and remembers the choice", async () => {
    render(<App />);
    expect(document.documentElement).toHaveClass("light");
    await chooseThemeEntry("Dark mode");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("light");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await chooseThemeEntry("Light mode");
    expect(document.documentElement).toHaveClass("light");
    expect(localStorage.getItem("theme")).toBe("light");
  });

  it("starts in the saved theme and offers the opposite one", async () => {
    localStorage.setItem("theme", "dark");
    render(<App />);
    expect(document.documentElement).toHaveClass("dark");
    await chooseThemeEntry("Light mode");
    expect(document.documentElement).toHaveClass("light");
  });

  it("still switches for the session when storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    render(<App />);
    await chooseThemeEntry("Dark mode");
    expect(document.documentElement).toHaveClass("dark");
  });
});
