import { useLayoutEffect, useRef, type RefObject } from "react";
import { Sprout, type SproutMood } from "./sprout";

interface ChatSproutProps {
  anchorRef: RefObject<HTMLDivElement | null>;
  messageIndex: number;
  active: boolean;
  mood: SproutMood;
}

// One canvas rig lives beside the conversation, independent of individual bubbles.
export function ChatSprout({ anchorRef, messageIndex, active, mood }: ChatSproutProps) {
  const positionRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef<HTMLDivElement>(null);
  const previousTop = useRef<number | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const position = positionRef.current;
    const list = position?.parentElement;
    if (!active || !anchor || !list || !position) return;
    let tilt: Animation | undefined;
    function followMessage() {
      if (!anchor || !position) return;
      const top = anchor.offsetTop;
      position.style.transform = `translateY(${top}px)`;
      const moved = previousTop.current !== null && previousTop.current !== top;
      if (moved && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        tilt?.cancel();
        tilt = motionRef.current?.animate?.(
          [{ rotate: "0deg" }, { rotate: "-10deg", offset: 0.35 }, { rotate: "0deg" }],
          { duration: 480, easing: "ease-in-out" },
        );
      }
      previousTop.current = top;
    }
    followMessage();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(followMessage);
    observer?.observe(list);
    observer?.observe(anchor);
    window.addEventListener("resize", followMessage);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", followMessage);
      tilt?.cancel();
    };
  }, [anchorRef, messageIndex, active]);

  return (
    <div ref={positionRef} className="chat-sprout" aria-hidden="true">
      <div ref={motionRef}>
        <Sprout compact mood={mood} />
      </div>
    </div>
  );
}
