import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LoginHelper } from "./login-helper";

it("greets, speaks during the welcome stream, then stays idle after user messages", async () => {
  vi.useFakeTimers();
  const { container, unmount } = render(<LoginHelper topic="welcome" />);
  const avatar = container.querySelector(".helper-launcher .sprout");
  try {
    expect(avatar).toHaveAttribute("data-mood", "idle");
    fireEvent.click(screen.getByRole("button", { name: "Open Sprout" }));
    expect(avatar).toHaveAttribute("data-mood", "greeting");
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(avatar).toHaveAttribute("data-mood", "replying");
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(avatar).toHaveAttribute("data-mood", "idle");

    const composer = screen.getByRole("textbox", { name: "Message Sprout" });
    fireEvent.change(composer, { target: { value: "Please help" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(avatar).toHaveAttribute("data-mood", "idle");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Minimize Sprout" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Sprout" }));
    expect(avatar).toHaveAttribute("data-mood", "greeting");
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(avatar).toHaveAttribute("data-mood", "idle");
  } finally {
    unmount();
    vi.useRealTimers();
  }
});
