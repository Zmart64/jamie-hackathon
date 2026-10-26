import { useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Finding } from "./model";
import { SeverityLabel } from "./severity";
import { EvidenceText } from "./session-evidence";
import { submittedRequest, toolReceipt } from "./recorded-run";
import { FindingScreenshots } from "./finding-screenshots";

export function FindingReport({
  finding,
  index,
  recorded,
}: {
  finding: Finding;
  index: number;
  recorded: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const evidenceId = useId();
  return (
    <Card className="min-w-0 gap-5 shadow-none" aria-label={finding.title}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground">
            F{String(index + 1).padStart(2, "0")}
          </span>
          <SeverityLabel severity={finding.severity} />
        </div>
        <h3 className="text-lg font-semibold tracking-tight">{finding.title}</h3>
        <p className="text-xs text-muted-foreground">
          {finding.scenario} · {finding.surface}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Impact</h4>
          <p className="text-sm leading-relaxed text-muted-foreground">{finding.impact}</p>
        </div>
        {finding.screenshots && <FindingScreenshots screenshots={finding.screenshots} />}
        <div className="space-y-4 border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            aria-expanded={expanded}
            aria-controls={evidenceId}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            {expanded ? "Hide evidence" : "View evidence & reproduction"}
          </Button>
          {expanded && (
            <div id={evidenceId} className="space-y-5">
              <ReportEvidence title="1. Submitted content" text={finding.input} />
              <ReportEvidence title="2. Recorded action" text={finding.action} />
              {recorded && finding.id === "recovery-change" && (
                <div className="grid min-w-0 gap-5 lg:grid-cols-2">
                  <ReportEvidence
                    title="Second injection · S3"
                    text={submittedRequest("tool-result", 3)}
                  />
                  <ReportEvidence
                    title="Second tool receipt"
                    text={toolReceipt("tool-result", 3)}
                  />
                </div>
              )}
              <ReportEvidence title="3. Verification evidence" text={finding.evidence} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReportEvidence({ title, text }: { title: string; text: string }) {
  return (
    <div className="min-w-0 space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <EvidenceText text={text} />
    </div>
  );
}
