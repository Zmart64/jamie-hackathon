import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginHelper } from "./login-helper";

const hello = "Hi, I’m Sprout, your login agent.";
const help = "A little help getting in? It looks like you can’t log in.";

describe("Sprout chat", () => {
  it("streams two welcome bubbles in order, pauses while minimized, and resumes without duplication", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<LoginHelper topic="welcome" />);
    try {
      await act(() => vi.advanceTimersByTimeAsync(5000));
      expect(screen.queryByText(hello)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Open Sprout" }));
      const history = screen.getByRole("log");
      await act(() => vi.advanceTimersByTimeAsync(480));
      expect(history).toHaveTextContent("Hi, I’m");
      expect(screen.queryByText(hello)).not.toBeInTheDocument();
      expect(screen.queryByText(help)).not.toBeInTheDocument();
      const partial = history.textContent;
      fireEvent.click(screen.getByRole("button", { name: "Dismiss helper" }));
      await act(() => vi.advanceTimersByTimeAsync(5000));
      expect(history.textContent).toBe(partial);
      fireEvent.click(screen.getByRole("button", { name: "Open Sprout" }));
      await act(() => vi.advanceTimersByTimeAsync(5000));
      expect(screen.getAllByText(hello)).toHaveLength(1);
      expect(screen.getAllByText(help)).toHaveLength(1);
      expect(screen.queryByRole("heading")).not.toBeInTheDocument();
      expect(screen.getAllByText("Sprout")).toHaveLength(1);
      expect(history.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it("accepts arbitrary messages without email validation or any scripted follow-up", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<LoginHelper topic="offer" />);
    try {
      await act(() => vi.advanceTimersByTimeAsync(5000));
      const composer = screen.getByRole("textbox", { name: "Message Sprout" });
      fireEvent.change(composer, { target: { value: "   " } });
      expect(screen.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument();
      for (const message of ["not-an-email", "My password is incorrect", "Anything at all"]) {
        fireEvent.change(composer, { target: { value: message } });
        fireEvent.click(screen.getByRole("button", { name: "Send message" }));
        expect(screen.getByText(message)).toBeVisible();
        expect(composer).toHaveValue("");
        expect(composer).toHaveFocus();
      }
      const history = screen.getByRole("log").textContent;
      await act(() => vi.advanceTimersByTimeAsync(10000));
      expect(screen.getByRole("log").textContent).toBe(history);
      expect(screen.getAllByText("Sprout")).toHaveLength(1);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(composer).not.toHaveAttribute("readonly");
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it("keeps a draft when minimized and submits once with Enter", async () => {
    const user = userEvent.setup();
    render(<LoginHelper topic="email" />);
    const composer = screen.getByRole("textbox", { name: "Message Sprout" });
    await user.type(composer, "I forgot which email I used");
    await user.keyboard("{Escape}{Enter}");
    expect(composer).toHaveValue("I forgot which email I used");
    expect(composer).toHaveFocus();
    await user.keyboard("{Enter}{Enter}");
    expect(screen.getAllByText("I forgot which email I used")).toHaveLength(1);
    expect(composer).toHaveValue("");
  });
});
