import { useEffect, useRef, type CSSProperties } from "react";
import { createSproutRenderer, type SproutMood } from "./sprout-renderer";

export type { SproutMood } from "./sprout-renderer";

export function Sprout({
  mood = "idle",
  compact = false,
}: {
  mood?: SproutMood;
  compact?: boolean;
}) {
  const bodyRef = useRef<HTMLCanvasElement>(null);
  const detailsRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createSproutRenderer>>(null);
  const size = compact ? 32 : 80;

  useEffect(() => {
    const body = bodyRef.current;
    const details = detailsRef.current;
    if (!body || !details || typeof Path2D === "undefined") return;
    const renderer = createSproutRenderer(body, details, size, compact);
    rendererRef.current = renderer;
    return () => {
      renderer?.dispose();
      rendererRef.current = null;
    };
  }, [size, compact]);

  useEffect(() => rendererRef.current?.setMood(mood), [mood]);

  return (
    <span
      className="sprout"
      data-mood={mood}
      data-compact={compact}
      aria-hidden="true"
      style={{ "--sprout-size": `${size}px` } as CSSProperties}
    >
      <span className="sprout-shadow" />
      <span className="sprout-character">
        <canvas ref={detailsRef} />
        <canvas ref={bodyRef} />
      </span>
    </span>
  );
}
