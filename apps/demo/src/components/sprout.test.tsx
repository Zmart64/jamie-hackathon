import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { json, mockSupport, turn } from "../lib/support-test-fixtures";
import { LoginHelper } from "./login-helper";

it("animates only the active reply and restores the launcher when closed", async () => {
  vi.useFakeTimers();
  const { container, unmount } = render(<LoginHelper topic="welcome" />);
  const activeAvatars = () => container.querySelectorAll('.chat-sprout [data-mood="replying"]');
  try {
    expect(screen.getByRole("button", { name: "Open Sprout" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Open Sprout" }));
    expect(screen.queryByRole("button", { name: "Open Sprout" })).not.toBeInTheDocument();
    expect(container.querySelector(".helper-launcher .sprout")).not.toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(480));
    expect(activeAvatars()).toHaveLength(1);
    expect(activeAvatars()[0]).toHaveAttribute("data-compact", "true");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss helper" }));
    expect(activeAvatars()).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Open Sprout" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Open Sprout" }));
    expect(activeAvatars()).toHaveLength(1);
    await act(() => vi.advanceTimersByTimeAsync(1400));
    const avatars = container.querySelectorAll(".chat-sprout .sprout");
    expect(avatars).toHaveLength(1);
    expect(avatars[0]).toHaveAttribute("data-mood", "replying");
    expect(screen.getByRole("log")).toHaveTextContent("A little help");
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(activeAvatars()).toHaveLength(0);

    const composer = screen.getByRole("textbox", { name: "Message Sprout" });
    fireEvent.change(composer, { target: { value: "Please help" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(activeAvatars()).toHaveLength(0);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  } finally {
    unmount();
    vi.useRealTimers();
  }
});

it("thinks before and between replies, with one avatar throughout the message group", async () => {
  vi.useFakeTimers();
  const { container, unmount } = render(<LoginHelper topic="offer" />);
  const avatar = () => container.querySelector(".chat-sprout .sprout");
  try {
    expect(avatar()).toHaveAttribute("data-mood", "thinking");
    expect(screen.getByRole("status")).toHaveTextContent("Sprout is thinking");
    await act(() => vi.advanceTimersByTimeAsync(480));
    expect(avatar()).toHaveAttribute("data-mood", "replying");
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(screen.getByText("Hi, I’m Sprout, your login agent.")).toBeVisible();
    expect(avatar()).toHaveAttribute("data-mood", "thinking");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss helper" }));
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(avatar()).toHaveAttribute("data-mood", "idle");
    fireEvent.click(screen.getByRole("button", { name: "Open Sprout" }));
    expect(avatar()).toHaveAttribute("data-mood", "thinking");
    await act(() => vi.advanceTimersByTimeAsync(900));
    expect(container.querySelectorAll(".chat-sprout .sprout")).toHaveLength(1);
    expect(avatar()).toHaveAttribute("data-mood", "replying");
    expect(screen.getByRole("log")).toHaveTextContent("A little help");
    const firstRow = screen
      .getByText("Hi, I’m Sprout, your login agent.")
      .closest(".chat-agent-row");
    expect(firstRow?.querySelector(".sprout")).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(avatar()).toHaveAttribute("data-mood", "idle");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  } finally {
    unmount();
    vi.useRealTimers();
  }
});

it("moves the same avatar and canvas down to the latest message without remounting", async () => {
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    const rows = [...(this.parentElement?.querySelectorAll(".chat-agent-row") ?? [])];
    return Math.max(0, rows.indexOf(this)) * 90;
  });
  const { container, unmount } = render(<LoginHelper topic="offer" />);
  try {
    const position = container.querySelector(".chat-sprout");
    const canvas = position?.querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(position).toHaveStyle({ transform: "translateY(0px)" });
    await act(() => vi.advanceTimersByTimeAsync(1900));
    expect(container.querySelectorAll(".chat-sprout")).toHaveLength(1);
    expect(container.querySelector(".chat-sprout canvas")).toBe(canvas);
    expect(position).toHaveStyle({ transform: "translateY(90px)" });
    expect(container.querySelectorAll(".chat-agent-row")).toHaveLength(2);
  } finally {
    unmount();
    vi.restoreAllMocks();
    vi.useRealTimers();
  }
});

it("sleeps after 30 quiet seconds, resets on typing, and wakes when reopened", async () => {
  vi.useFakeTimers();
  const { container, unmount } = render(<LoginHelper topic="offer" />);
  const avatar = () => container.querySelector(".chat-sprout .sprout");
  try {
    await act(() => vi.advanceTimersByTimeAsync(5000));
    const composer = screen.getByRole("textbox", { name: "Message Sprout" });
    fireEvent.change(composer, { target: { value: "A draft" } });
    await act(() => vi.advanceTimersByTimeAsync(29000));
    expect(avatar()).toHaveAttribute("data-mood", "idle");
    fireEvent.keyDown(composer, { key: "ArrowLeft" });
    await act(() => vi.advanceTimersByTimeAsync(29000));
    expect(avatar()).toHaveAttribute("data-mood", "idle");
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(avatar()).toHaveAttribute("data-mood", "sleeping");
    fireEvent.change(composer, { target: { value: "A longer draft" } });
    expect(avatar()).toHaveAttribute("data-mood", "idle");
    await act(() => vi.advanceTimersByTimeAsync(30000));
    expect(avatar()).toHaveAttribute("data-mood", "sleeping");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss helper" }));
    await act(() => vi.advanceTimersByTimeAsync(60000));
    fireEvent.click(screen.getByRole("button", { name: "Open Sprout" }));
    expect(avatar()).toHaveAttribute("data-mood", "idle");
    expect(composer).toHaveValue("A longer draft");
    expect(composer).toHaveFocus();
  } finally {
    unmount();
    vi.useRealTimers();
  }
});

it("moves Sprout from the thinking bubble to the received backend reply", async () => {
  const offset = vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.textContent?.includes("Thinking…") ? 400 : 300;
  });
  const fetchMock = mockSupport();
  let resolveReply!: (response: Response) => void;
  fetchMock.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveReply = resolve;
    }),
  );
  const { container, unmount } = render(<LoginHelper topic="offer" />);
  try {
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "I need help" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const avatar = container.querySelector(".chat-sprout");
    expect(avatar).toHaveStyle({ transform: "translateY(400px)" });
    await act(async () => {
      resolveReply(json(turn()));
      await Promise.resolve();
    });
    expect(screen.getByText("How can I help?")).toBeVisible();
    expect(avatar).toHaveStyle({ transform: "translateY(300px)" });
    expect(container.querySelector(".chat-sprout")).toBe(avatar);
  } finally {
    unmount();
    offset.mockRestore();
    vi.unstubAllGlobals();
  }
});
