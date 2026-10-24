import { useEffect, useRef, useState, type RefObject, type SubmitEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { SproutMood } from "./sprout";
import { useSupportChat } from "../hooks/use-support-chat";
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

function sproutMood(
  active: boolean,
  pending: boolean,
  streaming: boolean,
  betweenMessages: boolean,
  resting: SproutMood,
): SproutMood {
  if (!active) return "idle";
  if (pending) return "thinking";
  if (streaming) return betweenMessages ? "thinking" : "replying";
  return resting;
}

function ChatRecovery({
  chat,
  onRestart,
}: {
  chat: ReturnType<typeof useSupportChat>;
  onRestart: () => void;
}) {
  const { messages, pending } = chat;
  return (
    <>
      {chat.error && (
        <div className="chat-error">
          <p role="alert">{chat.error.message}</p>
          {chat.error.recovery === "check" && (
            <Button
              variant="link"
              size="sm"
              disabled={pending}
              onClick={() => void chat.checkConversation()}
            >
              Check conversation
            </Button>
          )}
        </div>
      )}
      {(messages.length > 0 || chat.error) && (
        <Button
          className="chat-restart"
          variant="link"
          size="sm"
          disabled={pending}
          onClick={onRestart}
        >
          Start new conversation
        </Button>
      )}
    </>
  );
}

export function SupportChat({ active }: SupportChatProps) {
  const [elapsed, setElapsed] = useState(0);
  const chat = useSupportChat();
  const { messages, draft, setDraft, pending } = chat;
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
  const streaming = shown < totalLength && messages.length === 0;
  const latestIndex = shown > firstLength ? 1 : 0;
  const betweenMessages = shown === 0 || shown === firstLength;
  const restingMood = sleepingAfter === activity ? "sleeping" : "idle";
  const mood = sproutMood(active, pending, streaming, betweenMessages, restingMood);
  const locked = pending || chat.blocked;
  const latestAssistant = messages.findLastIndex((message) => message.role === "assistant");
  const hasReply = latestAssistant >= 0;

  function wake() {
    setActivity((current) => current + 1);
  }

  useEffect(() => {
    if (!active || streaming || pending) return;
    const timer = window.setTimeout(() => setSleepingAfter(activity), 30_000);
    return () => window.clearTimeout(timer);
  }, [active, streaming, pending, activity]);

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
  }, [messages, shown, active, pending, chat.error]);

  function sendMessage(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.trim() && !locked) setElapsed(5000);
    void chat.send();
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
            const visible = messages.length ? text.length : shown - (index === 0 ? 0 : firstLength);
            return messages.length > 0 || index <= latestIndex ? (
              <IntroBubble
                key={text}
                text={text.slice(0, visible)}
                complete={visible >= text.length}
                latest={!hasReply && !pending && index === latestIndex}
                mood={mood}
                anchorRef={!hasReply && !pending && index === latestIndex ? latestMessageRef : null}
              />
            ) : null;
          })}
          {messages.map((message, index) =>
            message.role === "assistant" ? (
              <IntroBubble
                key={message.id}
                text={message.content}
                complete
                latest={!pending && index === latestAssistant}
                mood={mood}
                anchorRef={!pending && index === latestAssistant ? latestMessageRef : null}
              />
            ) : (
              <div key={message.id} className="chat-message chat-message-user">
                <span className="sr-only">You: </span>
                <p>{message.content}</p>
              </div>
            ),
          )}
          {pending && (
            <IntroBubble
              text=""
              complete={false}
              latest
              mood="thinking"
              anchorRef={latestMessageRef}
            />
          )}
          <ChatSprout
            anchorRef={latestMessageRef}
            messageIndex={latestIndex + messages.length * 2 + Number(pending)}
            active={active}
            mood={mood}
          />
        </div>
      </div>
      <ChatRecovery
        chat={chat}
        onRestart={() => {
          chat.restart();
          inputRef.current?.focus();
        }}
      />
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
          readOnly={locked}
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
            disabled={locked}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
        )}
      </form>
      <p className="chat-demo-note">Demo recovery · No real emails are sent.</p>
    </div>
  );
}
