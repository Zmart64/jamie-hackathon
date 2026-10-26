import { useEffect, useRef, useState } from "react";
import {
  createSession,
  getConversation,
  sendMessage,
  SupportRequestError,
  type ChatMessage,
  type Turn,
} from "../lib/support-api";

interface ChatError {
  message: string;
  recovery: "continue" | "check" | "restart";
}

function turnError(turn: Turn): ChatError | null {
  if (turn.error?.code === "missing_api_key") {
    return {
      message: "Sprout is temporarily unavailable. Please try again later.",
      recovery: "continue",
    };
  }
  return turn.status === "failed"
    ? {
        message: `${turn.error?.message ?? "Sprout couldn’t finish this reply."} Your message was received. Any completed demo actions remain in place.`,
        recovery: "continue",
      }
    : null;
}

function requestError(error: unknown, hasSession: boolean): ChatError {
  if (error instanceof SupportRequestError) {
    if (error.code === "not_found")
      return {
        message: "This conversation has expired. Start a new conversation to continue.",
        recovery: "restart",
      };
    if (error.code !== "session_busy") return { message: error.message, recovery: "continue" };
  }
  return hasSession
    ? {
        message:
          "The reply couldn’t be confirmed. Check the conversation before sending another message; your request may already have been processed.",
        recovery: "check",
      }
    : {
        message: "Couldn’t connect to Sprout. Please try sending your message again.",
        recovery: "continue",
      };
}

export function useSupportChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const session = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const blocked = error?.recovery === "check" || error?.recovery === "restart";

  useEffect(() => () => request.current?.abort(), []);

  function canSend(text: string) {
    return Boolean(text) && !blocked;
  }

  async function send(message: string) {
    const text = message.trim();
    if (!canSend(text) || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const optimistic: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((current) => [...current, optimistic]);
    setDraft("");
    setPending(true);
    setError(null);
    try {
      const id = session.current ?? (await createSession(controller.signal));
      if (controller.signal.aborted) return;
      session.current = id;
      const turn = await sendMessage(id, text, controller.signal);
      if (controller.signal.aborted) return;
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimistic.id),
        ...turn.messages,
      ]);
      setError(turnError(turn));
    } catch (cause) {
      if (controller.signal.aborted) return;
      const failure = requestError(cause, session.current !== null);
      setError(failure);
      if (failure.recovery !== "check") {
        setMessages((current) => current.filter((message) => message.id !== optimistic.id));
        setDraft(text);
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setPending(false);
      }
    }
  }

  async function checkConversation() {
    if (!session.current || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    try {
      const history = await getConversation(session.current, controller.signal);
      if (controller.signal.aborted) return;
      setMessages(history.messages);
      setError(turnError(history));
    } catch (cause) {
      if (!controller.signal.aborted) setError(requestError(cause, true));
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setPending(false);
      }
    }
  }

  function restart() {
    request.current?.abort();
    request.current = null;
    session.current = null;
    setMessages([]);
    setDraft("");
    setError(null);
    setPending(false);
  }

  return { messages, draft, setDraft, pending, error, blocked, send, checkConversation, restart };
}
