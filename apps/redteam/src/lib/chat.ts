export interface SupportChatOptions {
  baseUrl: string;
  accountIdentifier?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class SupportChatError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SupportChatError";
  }
}

const MAX_OUTPUT_CHARS = 18_000;
const MAX_ARG_CHARS = 1_200;
const MAX_RESULT_CHARS = 2_400;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function preview(value: unknown, maxChars: number): string {
  let text: string;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (text === undefined) return "undefined";
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n… output truncated by the redteam client …`;
}

function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

function formatToolEvents(events: unknown[]): string {
  if (events.length === 0) return "Tool receipts exposed in this turn: none.";
  const lines = ["Tool receipts exposed in this turn:"];
  for (const [index, entry] of events.entries()) {
    if (!isRecord(entry)) continue;
    const name = typeof entry.name === "string" ? entry.name : "unknown_tool";
    const failed = entry.is_error === true ? " [error]" : "";
    lines.push(
      `${index + 1}. ${name}${failed} args=${preview(entry.arguments, MAX_ARG_CHARS)} result=${preview(entry.result, MAX_RESULT_CHARS)}`,
    );
  }
  return lines.join("\n");
}

function requestError(response: Response, data: Record<string, unknown>): SupportChatError {
  const error = isRecord(data.error) ? data.error : null;
  const code = typeof error?.code === "string" ? error.code : "request_failed";
  const message =
    typeof error?.message === "string"
      ? error.message
      : `The support request failed (${response.status}).`;
  return new SupportChatError(code, message);
}

function formatTurn(data: Record<string, unknown>): string {
  const status = data.status === "failed" ? "failed" : "completed";
  const reply = typeof data.reply === "string" && data.reply.trim() ? data.reply : "(no reply)";
  const events = Array.isArray(data.tool_events) ? data.tool_events : [];
  const parts = [`Support assistant (turn ${status}):`, reply, "", formatToolEvents(events)];
  if (isRecord(data.error)) {
    const code = typeof data.error.code === "string" ? data.error.code : "unknown_error";
    const message =
      typeof data.error.message === "string" ? data.error.message : "The support turn failed.";
    parts.push("", `Turn error: ${code} — ${message}`);
  }
  return truncate(parts.join("\n"));
}

export class SupportChatClient {
  private sessionId: string | null = null;
  private readonly baseUrl: string;
  private readonly accountIdentifier: string | undefined;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SupportChatOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.accountIdentifier = options.accountIdentifier;
    this.timeoutMs = options.timeoutMs ?? 120_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async reset(signal?: AbortSignal): Promise<string> {
    const id = await this.createSession(signal);
    return `Started a fresh support conversation (session ${shortId(id)}). The previous conversation is no longer active.`;
  }

  async send(message: string, signal?: AbortSignal): Promise<string> {
    const id = this.sessionId ?? (await this.createSession(signal));
    try {
      const data = await this.request(
        `/sessions/${encodeURIComponent(id)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        },
        signal,
      );
      return formatTurn(data);
    } catch (error) {
      if (error instanceof SupportChatError && error.code === "not_found") {
        this.sessionId = null;
        throw new SupportChatError(
          "session_expired",
          "The support conversation expired. Call chat_reset to start a fresh one, then continue.",
        );
      }
      throw error;
    }
  }

  async history(signal?: AbortSignal): Promise<string> {
    if (this.sessionId === null) return "No support conversation has been started yet.";
    const data = await this.request(
      `/sessions/${encodeURIComponent(this.sessionId)}/messages`,
      { method: "GET" },
      signal,
    );
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const lines: string[] = [];
    for (const message of messages) {
      if (!isRecord(message)) continue;
      const role = message.role === "assistant" ? "assistant" : "user";
      const content = typeof message.content === "string" ? message.content : "";
      lines.push(`${role}: ${content}`);
    }
    return lines.length === 0 ? "The conversation is empty." : truncate(lines.join("\n\n"));
  }

  private async createSession(signal?: AbortSignal): Promise<string> {
    const body =
      this.accountIdentifier === undefined ? {} : { account_identifier: this.accountIdentifier };
    const data = await this.request(
      "/sessions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      signal,
    );
    const id = data.session_id;
    if (typeof id !== "string" || id.length === 0) {
      throw new SupportChatError(
        "invalid_response",
        "The support service did not return a session id.",
      );
    }
    this.sessionId = id;
    return id;
  }

  private async request(
    pathname: string,
    init: RequestInit,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchResponse(`${this.baseUrl}${pathname}`, init, signal);
    const data = await this.readJson(response);
    if (!response.ok && data.status !== "failed") {
      throw requestError(response, data);
    }
    return data;
  }

  private async fetchResponse(
    url: string,
    init: RequestInit,
    signal?: AbortSignal,
  ): Promise<Response> {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const combined = signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
    try {
      return await this.fetchImpl(url, { ...init, signal: combined });
    } catch {
      throw new SupportChatError(
        "unreachable",
        `Could not reach the support service at ${this.baseUrl}. Is it running?`,
      );
    }
  }

  private async readJson(response: Response): Promise<Record<string, unknown>> {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new SupportChatError(
        "invalid_response",
        `The support service returned ${response.status} without a JSON body.`,
      );
    }
    if (!isRecord(data)) {
      throw new SupportChatError(
        "invalid_response",
        "The support service returned an invalid response.",
      );
    }
    return data;
  }
}
