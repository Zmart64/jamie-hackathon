import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "cn";
import type { Assessment } from "./model";
import type { Selection } from "./canvas-model";
import { SeverityIcon } from "./severity";

export function FindingsList({
  run,
  selection,
  onSelect,
}: {
  run: Assessment | undefined;
  selection: Selection;
  onSelect: (selection: Selection) => void;
}) {
  if (!run) return <p className="p-8 text-sm text-muted-foreground">No findings yet.</p>;
  return (
    <div className="space-y-3">
      {run.findings.map((finding) => (
        <Button
          key={finding.id}
          variant="outline"
          className={cn(
            "h-auto w-full justify-start whitespace-normal p-5 text-left",
            selection.findingId === finding.id && "border-primary bg-primary/5",
          )}
          onClick={() => onSelect({ kind: "finding", findingId: finding.id })}
        >
          <SeverityIcon severity={finding.severity} className="size-5" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{finding.title}</span>
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              {finding.scenario} · {finding.surface}
            </span>
          </span>
          <span className="text-xs font-medium text-muted-foreground">{finding.severity}</span>
        </Button>
      ))}
      {run.state === "running" && !run.findings.length && (
        <p className="p-8 text-sm text-muted-foreground">No findings yet.</p>
      )}
      {run.state !== "running" && !run.findings.length && (
        <div className="rounded-lg border p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">No findings in tested scope</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Review coverage and incomplete evidence before drawing conclusions.
          </p>
        </div>
      )}
      {run.inconclusive > 0 && (
        <Button
          variant="outline"
          className="h-auto w-full whitespace-normal border-dashed p-4"
          onClick={() => onSelect({ kind: "gap" })}
        >
          {run.inconclusive} inconclusive attempts · Review coverage gaps
        </Button>
      )}
    </div>
  );
}
