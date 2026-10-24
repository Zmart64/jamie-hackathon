import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginHelper } from "./login-helper";

import { json, mockSupport, turn } from "../lib/support-test-fixtures";

afterEach(() => vi.unstubAllGlobals());

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
});
