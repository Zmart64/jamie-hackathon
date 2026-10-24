import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginHelper } from "./login-helper";
import { json, message, mockSupport, turn } from "../lib/support-test-fixtures";

afterEach(() => vi.unstubAllGlobals());

async function openAndSend(text = "I need help") {
  const user = userEvent.setup();
  render(<LoginHelper topic="offer" />);
  const composer = screen.getByRole("textbox", { name: "Message Sprout" });
  await user.type(composer, `${text}{Enter}`);
  return { user, composer };
}

describe("Support connection recovery", () => {
  it("allows only one pending turn and keeps its reply while minimized", async () => {
    const fetchMock = mockSupport();
    let resolveReply!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveReply = resolve;
      }),
    );
    const { user, composer } = await openAndSend();
    expect(screen.getByRole("status")).toHaveTextContent("Sprout is thinking");
    expect(composer).toHaveAttribute("readonly");
    await user.keyboard("{Enter}{Enter}{Escape}");
    await act(async () => {
      resolveReply(json(turn()));
      await Promise.resolve();
    });
    await user.click(screen.getByRole("button", { name: "Open Sprout" }));
    expect(screen.getByText("How can I help?")).toBeVisible();
    expect(screen.getAllByText("I need help")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(composer).not.toHaveAttribute("readonly");
  });

  it("restores the draft if session creation fails and lets the user send again", async () => {
    const fetchMock = mockSupport();
    fetchMock.mockReset().mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { user, composer } = await openAndSend();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn’t connect");
    expect(composer).toHaveValue("I need help");
    expect(screen.queryByText("I need help")).not.toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(json({ session_id: "session-2" }, 201));
    fetchMock.mockResolvedValueOnce(json(turn()));
    await user.keyboard("{Enter}");
    expect(await screen.findByText("How can I help?")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([502, 503])(
    "keeps accepted messages after a %s failed turn without replaying actions",
    async (status) => {
      const fetchMock = mockSupport();
      fetchMock.mockResolvedValueOnce(
        json(
          {
            ...turn(),
            status: "failed",
            reply: null,
            messages: [message("accepted", "user", "I need help")],
            error: { code: "provider_error", message: "The support service is unavailable." },
            tool_events: [{ name: "update_recovery_email", result: { updated: true } }],
          },
          status,
        ),
      );
      const { user, composer } = await openAndSend();
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Any completed demo actions remain in place",
      );
      expect(screen.getAllByText("I need help")).toHaveLength(1);
      expect(screen.queryByText("How can I help?")).not.toBeInTheDocument();
      expect(composer).toHaveValue("");
      expect(composer).not.toHaveAttribute("readonly");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      fetchMock.mockResolvedValueOnce(
        json(turn("What happened?", "Your recovery address was updated.", "2")),
      );
      await user.type(composer, "What happened?{Enter}");
      expect(await screen.findByText("Your recovery address was updated.")).toBeVisible();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    },
  );

  it("explains an unconfigured service without exposing server setup instructions", async () => {
    const fetchMock = mockSupport();
    fetchMock.mockResolvedValueOnce(
      json(
        {
          ...turn(),
          status: "failed",
          reply: null,
          messages: [message("accepted", "user", "I need help")],
          error: {
            code: "missing_api_key",
            message: "Set ANTHROPIC_API_KEY in the backend environment.",
          },
        },
        503,
      ),
    );
    await openAndSend();
    expect(await screen.findByRole("alert")).toHaveTextContent("temporarily unavailable");
    expect(screen.queryByText(/ANTHROPIC_API_KEY/)).not.toBeInTheDocument();
    expect(screen.getByText("Demo recovery · No real emails are sent.")).toBeVisible();
  });

  it("checks history after a lost reply and handles a busy session without resubmitting", async () => {
    const fetchMock = mockSupport();
    fetchMock.mockRejectedValueOnce(new TypeError("Connection lost"));
    const { user, composer } = await openAndSend();
    expect(await screen.findByRole("alert")).toHaveTextContent("reply couldn’t be confirmed");
    expect(composer).toHaveAttribute("readonly");
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: "session_busy", message: "Busy" } }, 409),
    );
    await user.click(screen.getByRole("button", { name: "Check conversation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("reply couldn’t be confirmed");
    fetchMock.mockResolvedValueOnce(json({ messages: turn().messages, turns: [turn()] }));
    await user.click(screen.getByRole("button", { name: "Check conversation" }));
    expect(await screen.findByText("How can I help?")).toBeVisible();
    expect(screen.getAllByText("I need help")).toHaveLength(1);
    expect(composer).not.toHaveAttribute("readonly");
    expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual([
      "POST",
      "POST",
      "GET",
      "GET",
    ]);
  });

  it("requires a fresh conversation after the backend loses the session", async () => {
    const fetchMock = mockSupport();
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: "not_found", message: "Session not found" } }, 404),
    );
    const { user, composer } = await openAndSend();
    expect(await screen.findByRole("alert")).toHaveTextContent("conversation has expired");
    expect(composer).toHaveAttribute("readonly");
    await user.click(screen.getByRole("button", { name: "Start new conversation" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(composer).toHaveValue("");
    expect(composer).toHaveFocus();
    fetchMock.mockResolvedValueOnce(json({ session_id: "fresh-session" }, 201));
    fetchMock.mockResolvedValueOnce(json(turn("Hello again")));
    await user.type(composer, "Hello again{Enter}");
    expect(await screen.findByText("How can I help?")).toBeVisible();
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/support/sessions/fresh-session/messages",
      expect.any(Object),
    );
  });

  it("treats invalid proxy responses as uncertain and never renders HTML", async () => {
    const fetchMock = mockSupport();
    fetchMock.mockResolvedValueOnce(new Response("<h1>Bad gateway</h1>", { status: 502 }));
    const { composer } = await openAndSend();
    expect(await screen.findByRole("alert")).toHaveTextContent("reply couldn’t be confirmed");
    expect(composer).toHaveAttribute("readonly");
    expect(screen.queryByRole("heading", { name: "Bad gateway" })).not.toBeInTheDocument();
  });

  it("preserves rejected text on validation errors without leaving a phantom message", async () => {
    const fetchMock = mockSupport();
    fetchMock.mockResolvedValueOnce(
      json({ error: { code: "invalid_request", message: "Message is invalid." } }, 422),
    );
    const { composer } = await openAndSend();
    expect(await screen.findByRole("alert")).toHaveTextContent("Message is invalid");
    expect(composer).toHaveValue("I need help");
    expect(screen.queryByText("I need help")).not.toBeInTheDocument();
  });

  it("aborts an abandoned conversation and ignores its late response", async () => {
    const fetchMock = mockSupport();
    let resolveReply!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveReply = resolve;
      }),
    );
    const { rerender } = render(<LoginHelper key="old" topic="offer" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "I need help" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const signal = fetchMock.mock.calls[1]?.[1]?.signal;
    rerender(<LoginHelper key="new" topic="offer" />);
    expect(signal?.aborted).toBe(true);
    await act(async () => {
      resolveReply(json(turn()));
      await Promise.resolve();
    });
    expect(screen.queryByText("How can I help?")).not.toBeInTheDocument();
    expect(screen.queryByText("I need help")).not.toBeInTheDocument();
  });
});
