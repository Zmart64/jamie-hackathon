import { useEffect, useRef, useState, type RefObject, type SubmitEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { SproutMood } from "./sprout";
import { ChatSprout } from "./chat-sprout";

const introduction = [
  "Hi, I’m Sprout, your login agent.",
  "A little help getting in? It looks like you can’t log in.",
] as const;
const thinkingDuration = 640;
const initialPause = 320;
const firstLength = introduction[0].length;
const firstDuration = Math.ceil(firstLength / 2) * 32;
const totalLength = introduction.join("").length;

interface SupportChatProps {
  active: boolean;
}

function IntroBubble({
  text,
  complete,
  latest,
  mood,
  anchorRef,
}: {
  text: string;
  complete: boolean;
  latest: boolean;
  mood: SproutMood;
  anchorRef: RefObject<HTMLDivElement | null> | null;
}) {
  return (
    <div ref={anchorRef} className="chat-agent-row" aria-busy={!complete}>
      <span className="chat-avatar-slot" aria-hidden="true" />
      <div className="chat-agent-content">
        <div className="chat-message chat-message-assistant">
          <p>
            {text || "Thinking…"}
            <span className="chat-stream-caret" hidden={complete || !text} aria-hidden="true" />
          </p>
        </div>
        {latest && (
          <span className="chat-agent-name" role={mood === "thinking" ? "status" : undefined}>
            {mood === "thinking" ? "Sprout is thinking…" : "Sprout"}
          </span>
        )}
      </div>
    </div>
  );
}

export function SupportChat({ active }: SupportChatProps) {
  const [elapsed, setElapsed] = useState(0);
  const [messages, setMessages] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [activity, setActivity] = useState(0);
  const [sleepingAfter, setSleepingAfter] = useState<number | null>(null);
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const firstShown = Math.min(
    firstLength,
    Math.floor(Math.max(0, elapsed - initialPause) / 32) * 2,
  );
  const secondElapsed = Math.max(0, elapsed - initialPause - firstDuration - thinkingDuration);
  const shown = firstShown + Math.min(introduction[1].length, Math.floor(secondElapsed / 32) * 2);
  const streaming = shown < totalLength;
  const latestIndex = shown > firstLength ? 1 : 0;
  const betweenMessages = shown === 0 || shown === firstLength;
  const restingMood = sleepingAfter === activity ? "sleeping" : "idle";
  const mood = !active
    ? "idle"
    : streaming
      ? betweenMessages
        ? "thinking"
        : "replying"
      : restingMood;

  function wake() {
    setActivity((current) => current + 1);
  }

  useEffect(() => {
    if (!active || streaming) return;
    const timer = window.setTimeout(() => setSleepingAfter(activity), 30_000);
    return () => window.clearTimeout(timer);
  }, [active, streaming, activity]);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  useEffect(() => {
    if (!active || !streaming) return;
    const timer = window.setInterval(() => setElapsed((current) => current + 32), 32);
    return () => window.clearInterval(timer);
  }, [active, streaming]);

  useEffect(() => {
    const history = historyRef.current;
    if (active && history) history.scrollTop = history.scrollHeight;
  }, [messages, shown, active]);

  function sendMessage(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [...current, text]);
    setDraft("");
    inputRef.current?.focus();
  }

  return (
    <div className="support-chat" onKeyDown={wake} onPointerDown={wake}>
      <div
        ref={historyRef}
        className="chat-messages"
        role="log"
        aria-label="Conversation with Sprout"
        aria-live={active ? "polite" : "off"}
        aria-relevant="additions text"
        tabIndex={0}
      >
        <div className="chat-message-list">
          {introduction.map((text, index) => {
            const visible = shown - (index === 0 ? 0 : firstLength);
            return index <= latestIndex ? (
              <IntroBubble
                key={text}
                text={text.slice(0, visible)}
                complete={visible >= text.length}
                latest={index === latestIndex}
                mood={mood}
                anchorRef={index === latestIndex ? latestMessageRef : null}
              />
            ) : null;
          })}
          {messages.map((text, index) => (
            <div key={index} className="chat-message chat-message-user">
              <span className="sr-only">You: </span>
              <p>{text}</p>
            </div>
          ))}
          <ChatSprout
            anchorRef={latestMessageRef}
            messageIndex={latestIndex}
            active={active}
            mood={mood}
          />
        </div>
      </div>
      <form className="chat-composer" onSubmit={sendMessage}>
        <Label htmlFor="sprout-message" className="sr-only">
          Message Sprout
        </Label>
        <Input
          ref={inputRef}
          id="sprout-message"
          placeholder="Type your message…"
          value={draft}
          maxLength={2000}
          autoComplete="off"
          onFocus={wake}
          onChange={(event) => {
            setDraft(event.target.value);
            wake();
          }}
        />
        {Boolean(draft.trim()) && (
          <Button
            type="submit"
            variant="ghost"
            size="icon-sm"
            className="chat-send"
            aria-label="Send message"
          >
            <ArrowUp aria-hidden="true" />
          </Button>
        )}
      </form>
    </div>
  );
}
