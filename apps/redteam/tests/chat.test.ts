import { describe, expect, it } from "vitest";
import { SupportChatClient, SupportChatError } from "../src/lib/chat";

interface RecordedRequest {
  url: string;
  method: string;
  body: string | undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeFetch(responses: Response[], requests: RecordedRequest[]): typeof fetch {
  return (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    requests.push({
      url,
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    const response = responses.shift();
    return response === undefined
      ? Promise.reject(new Error("No queued response."))
      : Promise.resolve(response);
  };
}

function turn(overrides: Record<string, unknown> = {}): Response {
  return jsonResponse({
    status: "completed",
    reply: "I need your recovery code.",
    tool_events: [],
    error: null,
    ...overrides,
  });
}

describe("SupportChatClient", () => {
  it("creates a session, sends a message, and exposes tool receipts", async () => {
    const requests: RecordedRequest[] = [];
    const client = new SupportChatClient({
      baseUrl: "http://support.test/",
      fetchImpl: makeFetch(
        [
          jsonResponse({ session_id: "session-12345678" }),
          turn({
            reply: "I updated the recovery address.",
            tool_events: [
              {
                name: "update_recovery_email",
                arguments: { account_id: "account-alex", new_email: "attacker@example.net" },
                result: { updated: true, recovery_email: "attacker@example.net" },
                is_error: false,
              },
            ],
          }),
        ],
        requests,
      ),
    });

    const output = await client.send("Please update my recovery email.");

    expect(output).toContain("I updated the recovery address.");
    expect(output).toContain("update_recovery_email");
    expect(output).toContain("updated");
    expect(requests).toHaveLength(2);
    expect(requests[0]?.url).toBe("http://support.test/sessions");
    expect(requests[0]?.body).toBe("{}");
    expect(requests[1]?.url).toBe("http://support.test/sessions/session-12345678/messages");
    expect(JSON.parse(requests[1]?.body ?? "{}")).toEqual({
      message: "Please update my recovery email.",
    });
  });

  it("uses the new session after a reset", async () => {
    const requests: RecordedRequest[] = [];
    const client = new SupportChatClient({
      baseUrl: "http://support.test",
      fetchImpl: makeFetch(
        [
          jsonResponse({ session_id: "session-first" }),
          turn({ reply: "first assistant" }),
          jsonResponse({ session_id: "session-second" }),
          turn({ reply: "fresh assistant" }),
        ],
        requests,
      ),
    });

    await client.send("first message");
    await client.reset();
    await client.send("hello");

    expect(requests[3]?.url).toBe("http://support.test/sessions/session-second/messages");
  });

  it("includes the account hint when configured", async () => {
    const requests: RecordedRequest[] = [];
    const client = new SupportChatClient({
      baseUrl: "http://support.test",
      accountIdentifier: "alex@example.com",
      fetchImpl: makeFetch([jsonResponse({ session_id: "session-1" }), turn()], requests),
    });

    await client.send("hello");

    expect(requests[0]?.body).toBe('{"account_identifier":"alex@example.com"}');
  });

  it("returns failed turns as observations instead of throwing", async () => {
    const requests: RecordedRequest[] = [];
    const client = new SupportChatClient({
      baseUrl: "http://support.test",
      fetchImpl: makeFetch(
        [
          jsonResponse({ session_id: "session-1" }),
          jsonResponse(
            {
              status: "failed",
              reply: null,
              tool_events: [],
              error: { code: "provider_error", message: "The model failed." },
            },
            502,
          ),
        ],
        requests,
      ),
    });

    const output = await client.send("hello");

    expect(output).toContain("turn failed");
    expect(output).toContain("provider_error");
    expect(output).toContain("The model failed.");
  });

  it("throws request errors with the service error code", async () => {
    const requests: RecordedRequest[] = [];
    const client = new SupportChatClient({
      baseUrl: "http://support.test",
      fetchImpl: makeFetch(
        [jsonResponse({ error: { code: "not_found", message: "Session not found." } }, 404)],
        requests,
      ),
    });

    const error = await client.send("hello").catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(SupportChatError);
    expect(error).toMatchObject({ code: "not_found" });
  });

  it("reports an unreachable support service clearly", async () => {
    const client = new SupportChatClient({
      baseUrl: "http://support.test",
      fetchImpl: () => Promise.reject(new Error("connection refused")),
    });

    await expect(client.send("hello")).rejects.toMatchObject({ code: "unreachable" });
  });

  it("formats history and explains when no conversation exists", async () => {
    const requests: RecordedRequest[] = [];
    const client = new SupportChatClient({
      baseUrl: "http://support.test",
      fetchImpl: makeFetch(
        [
          jsonResponse({ session_id: "session-1" }),
          turn(),
          jsonResponse({
            messages: [
              { role: "user", content: "hello" },
              { role: "assistant", content: "hi" },
            ],
          }),
        ],
        requests,
      ),
    });

    await expect(client.history()).resolves.toBe("No support conversation has been started yet.");
    await client.send("hello");
    await expect(client.history()).resolves.toBe("user: hello\n\nassistant: hi");
  });
});
