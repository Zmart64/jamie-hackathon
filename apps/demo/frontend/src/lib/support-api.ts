export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface Turn {
  status: "completed" | "failed";
  messages: ChatMessage[];
  error: ApiErrorDetail | null;
}

export class SupportRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isErrorDetail(value: unknown): value is ApiErrorDetail {
  return isRecord(value) && typeof value.code === "string" && typeof value.message === "string";
}

function isMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string"
  );
}

function readMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || !value.every(isMessage)) {
    throw new Error("Invalid conversation response.");
  }
  return value;
}

async function request(path: string, signal: AbortSignal, body?: object) {
  const response = await fetch(`/api/support${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal,
  });
  const data: unknown = await response.json();
  if (!isRecord(data)) throw new Error("Invalid support response.");
  // A failed turn still contains accepted messages and may have executed tools.
  if (!response.ok && data.status !== "failed") {
    if (isErrorDetail(data.error)) {
      throw new SupportRequestError(data.error.code, data.error.message);
    }
    throw new Error("Support is unavailable.");
  }
  return data;
}

export async function createSession(signal: AbortSignal): Promise<string> {
  const data = await request("/sessions", signal, {});
  if (typeof data.session_id !== "string" || !data.session_id) {
    throw new Error("Invalid support session.");
  }
  return data.session_id;
}

export async function sendMessage(
  session: string,
  message: string,
  signal: AbortSignal,
): Promise<Turn> {
  const data = await request(`/sessions/${encodeURIComponent(session)}/messages`, signal, {
    message,
  });
  if (data.status !== "completed" && data.status !== "failed") {
    throw new Error("Invalid support turn.");
  }
  return {
    status: data.status,
    messages: readMessages(data.messages),
    error: isErrorDetail(data.error) ? data.error : null,
  };
}

export async function getConversation(session: string, signal: AbortSignal): Promise<Turn> {
  const data = await request(`/sessions/${encodeURIComponent(session)}/messages`, signal);
  const turns: unknown[] = Array.isArray(data.turns) ? data.turns : [];
  const last: unknown = turns.at(-1);
  const error = isRecord(last) && isErrorDetail(last.error) ? last.error : null;
  return { messages: readMessages(data.messages), status: error ? "failed" : "completed", error };
}
