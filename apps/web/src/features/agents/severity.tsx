import { cn } from "cn";
import type { Severity } from "./model";

const filledBars: Record<Severity, number> = { High: 3, Medium: 2, Low: 1 };
const severityColor: Record<Severity, string> = {
  High: "text-severity-high",
  Medium: "text-severity-medium",
  Low: "text-severity-low",
};

/* Lucide has no stepped signal glyph whose bars fill by level, so severity uses
 * this small local icon (see apps/web/AGENTS.md). Pair it with a word. */
export function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  const filled = filledBars[severity];
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      data-severity={severity}
      className={cn("size-4 shrink-0", severityColor[severity], className)}
    >
      {[0, 1, 2].map((bar) => (
        <rect
          key={bar}
          x={1.5 + bar * 5}
          y={10 - bar * 4}
          width="3"
          height={4.5 + bar * 4}
          rx="1"
          opacity={bar < filled ? 1 : 0.22}
          data-filled={bar < filled}
        />
      ))}
    </svg>
  );
}

export function SeverityLabel({
  severity,
  count,
  className,
}: {
  severity: Severity;
  count?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-medium", className)}>
      <SeverityIcon severity={severity} />
      {count === undefined ? severity : `${count} ${severity}`}
    </span>
  );
}
