import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { json, mockSupport, turn } from "./lib/support-test-fixtures";
import { App } from "./app";

async function enterEmail(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole("textbox", { name: "Work email" }), "demo@carbonzero.example");
  await user.keyboard("{Enter}");
}

async function failLogin(user: ReturnType<typeof userEvent.setup>, password = "demo-password") {
  await user.type(screen.getByLabelText("Password", { exact: true }), password);
  await user.keyboard("{Enter}");
  expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Your email or password is incorrect.",
  );
}

describe("Carbon Zero demo", () => {
  it("keeps Sprout available from the start and after closing its help panel", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("button", { name: "Open Sprout" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("region", { name: "Sprout" })).not.toBeInTheDocument();
    await user.click(screen.getByText("Need help?"));
    expect(screen.getByRole("region", { name: "Sprout" })).toBeVisible();
    expect(
      await within(screen.getByRole("log")).findByText(
        "Ask me anything, or pick a question below.",
        {},
        { timeout: 3000 },
      ),
    ).toBeVisible();
    expect(screen.queryByText(/It looks like you can’t log in/)).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Suggested questions" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: /A little help getting in/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Message Sprout" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Dismiss helper" }));
    expect(screen.getByRole("button", { name: "Open Sprout" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("region", { name: "Sprout" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Open Sprout" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Work email" })).toHaveValue("");
  });

  it("starts with email only and validates it before revealing a focused password field", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("textbox", { name: "Work email" })).toHaveFocus();
    expect(screen.queryByLabelText("Password", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Sprout" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "   ");
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), "invalid-email");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please enter a valid email address.");
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByLabelText("Password", { exact: true })).not.toBeInTheDocument();
    await user.clear(screen.getByRole("textbox"));
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
    await enterEmail(user);
    expect(screen.getByLabelText("Password", { exact: true })).toHaveFocus();
    expect(screen.queryByRole("textbox", { name: "Work email" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("requires a password, toggles its visibility, and returns to the email without retaining it", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterEmail(user);
    expect(screen.queryByRole("button", { name: "Log in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show password" })).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Sprout" })).toBeVisible();
    await user.type(screen.getByLabelText("Password", { exact: true }), "not-a-real-password");
    expect(screen.getByRole("button", { name: "Log in" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("type", "password");
    await user.clear(screen.getByLabelText("Password", { exact: true }));
    expect(screen.queryByRole("button", { name: "Log in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show password" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Password", { exact: true }), "another-demo-password");
    await user.click(screen.getByRole("button", { name: /Change email address/ }));
    expect(screen.getByRole("textbox", { name: "Work email" })).toHaveValue(
      "demo@carbonzero.example",
    );
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
  });

  it("rejects every attempt and offers help again after being dismissed", async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterEmail(user);
    for (const password of ["anything", "a completely different password"]) {
      await failLogin(user, password);
      expect(
        await screen.findByText(
          "A little help getting in? It looks like you can’t log in.",
          {},
          { timeout: 3000 },
        ),
      ).toBeVisible();
      expect(screen.getByLabelText("Password", { exact: true })).toHaveValue("");
      expect(screen.queryByRole("button", { name: "Log in" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Show password" })).not.toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Sprout" })).toBeVisible();
      await user.click(screen.getByRole("button", { name: "Dismiss helper" }));
      expect(screen.queryByRole("region", { name: "Sprout" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Open Sprout" })).toHaveFocus();
    }
    // Two rejected logins each include the delay and a full streamed greeting.
  }, 10_000);

  it("preserves the conversation through help actions and sends only chat text without storage writes", async () => {
    const user = userEvent.setup();
    const fetchSpy = mockSupport();
    fetchSpy.mockResolvedValueOnce(json(turn("demo@carbonzero.example")));
    fetchSpy.mockResolvedValueOnce(
      json(turn("It says my password is incorrect", "Let’s help you recover access.", "2")),
    );
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    try {
      render(<App />);
      await enterEmail(user);
      await failLogin(user);
      const composer = screen.getByRole("textbox", { name: "Message Sprout" });
      await waitFor(() => expect(composer).toHaveFocus());
      expect(await screen.findByText("Hi, I’m Sprout, your Carbon Zero agent.")).toBeVisible();
      expect(fetchSpy).not.toHaveBeenCalled();
      await user.type(composer, "demo@carbonzero.example");
      await user.keyboard("{Enter}");
      expect(await screen.findByText("How can I help?")).toBeVisible();
      await user.type(composer, "It says my password is incorrect");
      await user.click(screen.getByRole("button", { name: "Send message" }));
      expect(await screen.findByText("Let’s help you recover access.")).toBeVisible();
      expect(screen.getByText("It says my password is incorrect")).toBeVisible();
      expect(screen.queryByText(/Check that Caps Lock is off/)).not.toBeInTheDocument();
      expect(within(screen.getByRole("log")).getByText("demo@carbonzero.example")).toBeVisible();
      await user.keyboard("{Escape}");
      expect(screen.getByRole("button", { name: "Open Sprout" })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await user.keyboard("{Enter}");
      expect(screen.getByText("It says my password is incorrect")).toBeVisible();
      expect(screen.queryByRole("button", { name: "Send a reset link" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Forgot password?" }));
      expect(screen.getByText("Let’s help you recover access.")).toBeVisible();
      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(fetchSpy.mock.calls.map(([, options]) => options?.body)).toEqual([
        "{}",
        JSON.stringify({ message: "demo@carbonzero.example" }),
        JSON.stringify({ message: "It says my password is incorrect" }),
      ]);
      expect(storageSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      storageSpy.mockRestore();
    }
  });

  it("opens the welcome chat from both forgot links and clears it when changing email", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Forgot email?" }));
    expect(await screen.findByText("Hi, I’m Sprout, your Carbon Zero agent.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Dismiss helper" }));
    await enterEmail(user);
    await user.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(await screen.findByText("Hi, I’m Sprout, your Carbon Zero agent.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Change email address/ }));
    expect(screen.queryByRole("region", { name: "Sprout" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Sprout" })).toBeVisible();
  });

  it("returns to a clean email step on remount", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await enterEmail(user);
    await user.type(screen.getByLabelText("Password", { exact: true }), "demo-password");
    await user.keyboard("{Enter}");
    unmount();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Work email" })).toHaveValue(""),
    );
    expect(screen.getByRole("button", { name: "Open Sprout" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
