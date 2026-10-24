import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Sprout } from "./sprout";

const introduction = [
  "Hi, I’m Sprout, your login agent.",
  "A little help getting in? It looks like you can’t log in.",
] as const;
const firstLength = introduction[0].length;
const firstDuration = Math.ceil(firstLength / 2) * 32;
const totalLength = introduction.join("").length;

interface SupportChatProps {
  active: boolean;
  onStreamingChange: (streaming: boolean) => void;
}

function IntroBubble({ text, complete }: { text: string; complete: boolean }) {
  return (
    <div className="chat-agent-row" aria-busy={!complete}>
      <Sprout compact />
      <div className="chat-agent-content">
        <div className="chat-message chat-message-assistant">
          <p>
            {text}
            <span className="chat-stream-caret" hidden={complete} aria-hidden="true" />
          </p>
        </div>
        <span className="chat-agent-name">Sprout</span>
      </div>
    </div>
  );
}

export function SupportChat({ active, onStreamingChange }: SupportChatProps) {
  const [elapsed, setElapsed] = useState(0);
  const [messages, setMessages] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const firstShown = Math.min(firstLength, Math.floor(elapsed / 32) * 2);
  const secondElapsed = Math.max(0, elapsed - firstDuration - 350);
  const shown = firstShown + Math.min(introduction[1].length, Math.floor(secondElapsed / 32) * 2);
  const streaming = shown < totalLength;

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  useEffect(() => {
    onStreamingChange(active && streaming);
  }, [active, streaming, onStreamingChange]);

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
    <div className="support-chat">
      <div
        ref={historyRef}
        className="chat-messages"
        role="log"
        aria-label="Conversation with Sprout"
        aria-live={active ? "polite" : "off"}
        aria-relevant="additions text"
        tabIndex={0}
      >
        {introduction.map((text, index) => {
          const visible = shown - (index === 0 ? 0 : firstLength);
          return visible > 0 ? (
            <IntroBubble
              key={text}
              text={text.slice(0, visible)}
              complete={visible >= text.length}
            />
          ) : null;
        })}
        {messages.map((text, index) => (
          <div key={index} className="chat-message chat-message-user">
            <span className="sr-only">You: </span>
            <p>{text}</p>
          </div>
        ))}
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
          onChange={(event) => setDraft(event.target.value)}
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
