import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginHelper } from "./login-helper";

import { json, mockSupport, turn } from "../lib/support-test-fixtures";

afterEach(() => vi.unstubAllGlobals());

const hello = "Hi, I’m Sprout, your Carbon Zero agent.";
const help = "Ask me anything, or pick a question below.";

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

  it("sends arbitrary text, reuses its session and reconciles server messages without duplicate replies", async () => {
    const fetchMock = mockSupport();
    fetchMock.mockResolvedValueOnce(json(turn("not-an-email")));
    fetchMock.mockResolvedValueOnce(
      json(turn("My password is incorrect", "Let’s check your account.", "2")),
    );
    const user = userEvent.setup();
    render(<LoginHelper topic="offer" />);
    const composer = screen.getByRole("textbox", { name: "Message Sprout" });
    await user.type(composer, "   ");
    expect(screen.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument();
    await user.type(composer, "not-an-email{Enter}");
    expect(await screen.findByText("How can I help?")).toBeVisible();
    expect(screen.getAllByText("not-an-email")).toHaveLength(1);
    expect(screen.getAllByText("How can I help?")).toHaveLength(1);
    await user.type(composer, "My password is incorrect{Enter}");
    expect(await screen.findByText("Let’s check your account.")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/support/sessions",
      expect.objectContaining({ body: "{}", method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/support/sessions/session-1/messages",
      expect.objectContaining({ body: JSON.stringify({ message: "My password is incorrect" }) }),
    );
    expect(composer).toHaveValue("");
    expect(composer).toHaveFocus();
  });

  it("keeps a draft when minimized and submits once with Enter", async () => {
    const fetchMock = mockSupport();
    fetchMock.mockResolvedValueOnce(json(turn("I forgot which email I used")));
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
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it.each([
    ["password", "Forgot your password? I can help you reset it."],
    ["email", "Forgot your account email? Let’s help you find your account."],
  ] as const)(
    "uses a specific %s greeting without claiming a failed login",
    async (topic, greeting) => {
      vi.useFakeTimers();
      const { unmount } = render(<LoginHelper topic={topic} />);
      try {
        await act(() => vi.advanceTimersByTimeAsync(5000));
        expect(screen.getByText(greeting)).toBeVisible();
        expect(screen.queryByText(/It looks like you can’t log in/)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Find my account" })).toBeVisible();
      } finally {
        unmount();
        vi.useRealTimers();
      }
    },
  );

  it("updates an empty welcome after a failed login without discarding a draft", async () => {
    vi.useFakeTimers();
    const { rerender, unmount } = render(<LoginHelper topic="welcome" />);
    try {
      fireEvent.click(screen.getByRole("button", { name: "Open Sprout" }));
      await act(() => vi.advanceTimersByTimeAsync(5000));
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "My question" } });
      rerender(<LoginHelper topic="offer" openRequest={1} />);
      await act(() => vi.advanceTimersByTimeAsync(5000));
      expect(
        screen.getByText("A little help getting in? It looks like you can’t log in."),
      ).toBeVisible();
      expect(screen.queryByText(help)).not.toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveValue("My question");
      expect(screen.queryByRole("group", { name: "Suggested questions" })).not.toBeInTheDocument();
    } finally {
      unmount();
      vi.useRealTimers();
    }
  });

  it("submits a suggested FAQ once, preserves history through help actions, and resets to a general welcome", async () => {
    const fetchMock = mockSupport();
    let resolveReply!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveReply = resolve;
      }),
    );
    const user = userEvent.setup();
    const { rerender } = render(<LoginHelper topic="welcome" />);
    await user.click(screen.getByRole("button", { name: "Open Sprout" }));
    const question = await screen.findByRole(
      "button",
      { name: "What’s a carbon footprint?" },
      { timeout: 4000 },
    );
    question.focus();
    await user.keyboard("{Enter}{Enter}");
    expect(screen.getAllByText("What is a carbon footprint?")).toHaveLength(1);
    expect(screen.queryByRole("group", { name: "Suggested questions" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/support/sessions/session-1/messages",
      expect.objectContaining({ body: JSON.stringify({ message: "What is a carbon footprint?" }) }),
    );
    await act(async () => {
      resolveReply(
        json(turn("What is a carbon footprint?", "It measures greenhouse gas emissions.")),
      );
      await Promise.resolve();
    });
    expect(screen.getByText("It measures greenhouse gas emissions.")).toBeVisible();
    rerender(<LoginHelper topic="offer" openRequest={1} />);
    expect(screen.getByText(help)).toBeInTheDocument();
    expect(screen.getByText("It measures greenhouse gas emissions.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start new conversation" }));
    expect(screen.getByText(help)).toBeVisible();
    expect(screen.queryByText("It measures greenhouse gas emissions.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What’s a carbon footprint?" })).toBeVisible();
    expect(screen.getByRole("textbox")).toHaveFocus();
    rerender(<LoginHelper topic="offer" openRequest={2} />);
    expect(
      await screen.findByText(
        "A little help getting in? It looks like you can’t log in.",
        {},
        { timeout: 4000 },
      ),
    ).toBeVisible();
    expect(screen.queryByText(help)).not.toBeInTheDocument();
    // This flow waits for both the welcome and failed-login greeting animations.
  }, 10_000);

  it("restores a suggested question in the composer when sending fails", async () => {
    const fetchMock = mockSupport();
    fetchMock.mockReset().mockRejectedValueOnce(new TypeError("Offline"));
    const user = userEvent.setup();
    render(<LoginHelper topic="welcome" />);
    await user.click(screen.getByRole("button", { name: "Open Sprout" }));
    await user.click(
      await screen.findByRole("button", { name: "Reset my password" }, { timeout: 4000 }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t connect");
    expect(screen.getByRole("textbox")).toHaveValue("How do I reset my Carbon Zero password?");
    fetchMock.mockResolvedValueOnce(json({ session_id: "retry-session" }, 201));
    fetchMock.mockResolvedValueOnce(json(turn("How do I reset my Carbon Zero password?")));
    await user.keyboard("{Enter}");
    expect(await screen.findByText("How can I help?")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
