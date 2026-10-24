import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "./ui/button";
import { Sprout } from "./sprout";
import { SupportChat } from "./support-chat";

export type HelpTopic = "welcome" | "offer" | "password" | "email";

export function LoginHelper({ topic }: { topic: HelpTopic }) {
  const [open, setOpen] = useState(topic !== "welcome");
  const launcherRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (!open && restoreFocus.current) {
      launcherRef.current?.focus();
      restoreFocus.current = false;
    }
  }, [open]);

  function close() {
    setOpen(false);
    restoreFocus.current = true;
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
          size="icon"
          className="helper-dismiss"
          aria-label="Dismiss helper"
          onClick={close}
        >
          <X aria-hidden="true" />
        </Button>
        <SupportChat active={open} />
      </section>
      <Button
        ref={launcherRef}
        variant="ghost"
        className="helper-launcher"
        hidden={open}
        aria-label="Open Sprout"
        aria-expanded={open}
        aria-controls="helper-panel"
        onClick={() => setOpen(true)}
      >
        {!open && <Sprout />}
      </Button>
    </aside>
  );
}
