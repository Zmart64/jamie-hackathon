import { vi } from "vitest";

export function message(id: string, role: "user" | "assistant", content: string) {
  return { id, turn_id: "turn-1", role, content, created_at: "2026-10-24T12:00:00Z" };
}

export function turn(text = "I need help", reply = "How can I help?", suffix = "1") {
  return {
    session_id: "session-1",
    turn_id: `turn-${suffix}`,
    status: "completed",
    reply,
    messages: [
      message(`user-${suffix}`, "user", text),
      message(`assistant-${suffix}`, "assistant", reply),
    ],
    tool_events: [],
    error: null,
  };
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function mockSupport() {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValueOnce(json({ session_id: "session-1" }, 201));
  return fetchMock;
}
