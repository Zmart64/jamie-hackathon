import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { Sprout } from "./sprout";
import { SupportChat } from "./support-chat";

export type HelpTopic = "welcome" | "offer" | "password" | "email";

export function LoginHelper({ topic }: { topic: HelpTopic }) {
  const [open, setOpen] = useState(topic !== "welcome");
  const [greeting, setGreeting] = useState(topic !== "welcome");
  const [streaming, setStreaming] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const mood = greeting ? "greeting" : streaming && open ? "replying" : "idle";

  useEffect(() => {
    if (!greeting) return;
    const timer = window.setTimeout(() => setGreeting(false), 950);
    return () => window.clearTimeout(timer);
  }, [greeting]);

  function close() {
    setOpen(false);
    setGreeting(false);
    launcherRef.current?.focus();
  }

  return (
    <aside
      className="helper"
      aria-label="Sprout login assistant"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <section className="helper-bubble" id="helper-panel" aria-label="Sprout" hidden={!open}>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="helper-dismiss"
          aria-label="Dismiss helper"
          onClick={close}
        >
          <X aria-hidden="true" />
        </Button>
        <SupportChat active={open} onStreamingChange={setStreaming} />
      </section>
      <Button
        ref={launcherRef}
        variant="ghost"
        className="helper-launcher"
        aria-label={open ? "Minimize Sprout" : "Open Sprout"}
        aria-expanded={open}
        aria-controls="helper-panel"
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setOpen(true);
          setGreeting(true);
        }}
      >
        <Sprout mood={mood} />
      </Button>
    </aside>
  );
}
