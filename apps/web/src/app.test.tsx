import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./app";

describe("concept workspace", () => {
  it("keeps keyboard focus on the trace disclosure when expanding and collapsing", async () => {
    const user = userEvent.setup();
    render(<App />);
    const trigger = screen.getByRole("button", { name: "View sample trace" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Execution evidence" })).toBeVisible();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Execution evidence" })).not.toBeInTheDocument();
  });

  it("distinguishes the simulated failure from the proposed control and resets", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByRole("heading", { name: "Execution evidence" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View sample trace" }));
    expect(screen.getByRole("status")).toHaveTextContent("Unauthorized refund issued");
    expect(screen.getByText(/Simulated evidence/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "With protection" }));
    expect(screen.getByRole("status")).toHaveTextContent("Refund held for approval");
    expect(screen.getByRole("button", { name: "With protection" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByText("Unauthorized refund issued")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reset view" }));
    await user.click(screen.getByRole("button", { name: "View sample trace" }));
    expect(screen.getByRole("status")).toHaveTextContent("Unauthorized refund issued");
  });

  it("handles an empty search result and recovers without stale evidence", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "View sample trace" }));
    await user.type(screen.getByRole("textbox", { name: "Search scenarios" }), "unknown");
    expect(screen.getByRole("status")).toHaveTextContent("No matching scenarios");
    expect(screen.queryByText("Unauthorized refund issued")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("textbox", { name: "Search scenarios" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "View sample trace" })).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "Search scenarios" }), " REFUND ");
    expect(screen.getByRole("heading", { name: "Refund policy bypass" })).toBeVisible();
  });
});
