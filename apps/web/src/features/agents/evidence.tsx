import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, FlaskConical, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Agent, Assessment, Finding } from "./model";
import type { Selection } from "./canvas";
import { DemoEvidence } from "./demo-evidence";
import { SeverityLabel } from "./severity";

export function EvidencePanel({
  agent,
  run,
  selection,
  onRetest,
  busy,
}: {
  agent: Agent;
  run: Assessment | undefined;
  selection: Selection;
  onRetest: (id: string) => void;
  busy: boolean;
}) {
  if (!run) return null;
  if (run.demo) return <DemoEvidence run={run} selection={selection} />;
  const finding = run.findings.find((item) => item.id === selection.findingId);
  return (
    <Card className="min-w-0 gap-4 self-start shadow-none" aria-label="Evidence details">
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground">
            EVIDENCE DETAILS
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {finding ? (
          <FindingEvidence
            key={`${finding.id}-${selection.kind}`}
            finding={finding}
            kind={selection.kind}
            onRetest={() => onRetest(finding.id)}
            busy={busy}
          />
        ) : (
          <StepEvidence agent={agent} run={run} selection={selection} />
        )}
        <p className="border-t pt-4 text-xs leading-relaxed text-muted-foreground">
          Simulated API trace. Internal model reasoning and browser screenshots are unavailable.
          Evidence below describes observable demo actions.
        </p>
      </CardContent>
    </Card>
  );
}
function FindingEvidence({
  finding,
  kind,
  onRetest,
  busy,
}: {
  finding: Finding;
  kind: Selection["kind"];
  onRetest: () => void;
  busy: boolean;
}) {
  const [replaying, setReplaying] = useState(false);
  const [replayStep, setReplayStep] = useState(0);
  const sequence = [
    { title: "1. Submit adversarial input", text: finding.input },
    { title: "2. Observe the agent’s action", text: finding.action },
    { title: "3. Verify the outcome", text: finding.evidence },
  ];
  const current = sequence[replayStep] ?? sequence[0];
  const titles = {
    baseline: "Baseline",
    surface: "Surface",
    plan: "Plan",
    attempt: "Attack attempt",
    verification: "Verify observed behavior",
    finding: finding.title,
    gap: "Gap",
    blocked: "Blocked",
    sharedNotes: "Report notes",
  };
  return (
    <>
      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          <SeverityLabel severity={finding.severity} className="mr-1" />
          <Badge variant="outline">
            <CheckCircle2 className="size-3" aria-hidden="true" />
            Confirmed
          </Badge>
        </div>
        <h3 className="text-lg font-semibold leading-snug">{titles[kind]}</h3>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{finding.impact}</p>
      </div>
      {(kind === "attempt" || kind === "finding") && (
        <EvidenceBlock title="Submitted content" text={finding.input} />
      )}
      <EvidenceBlock title="Recorded action" text={finding.action} code />
      <EvidenceBlock title="Verification evidence" text={finding.evidence} />
      {replaying && current && (
        <div
          className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-3"
          aria-label="Attempt replay"
        >
          <p className="text-xs font-semibold" aria-live="polite">
            {current.title}
          </p>
          <p className="break-words text-xs leading-relaxed">{current.text}</p>
          <div className="flex justify-between gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={replayStep === 0}
              onClick={() => setReplayStep(replayStep - 1)}
              aria-label="Previous replay step"
            >
              <ArrowLeft aria-hidden="true" />
            </Button>
            <span className="self-center text-xs text-muted-foreground">{replayStep + 1} / 3</span>
            <Button
              size="sm"
              variant="outline"
              disabled={replayStep === 2}
              onClick={() => setReplayStep(replayStep + 1)}
              aria-label="Next replay step"
            >
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setReplaying(!replaying);
          setReplayStep(0);
        }}
      >
        <Play aria-hidden="true" />
        {replaying ? "Close replay" : "Replay recorded attempt"}
      </Button>
      <div className="border-t pt-4">
        <h4 className="mb-2 text-sm font-medium">Suggested remediation</h4>
        <p className="text-sm leading-relaxed text-muted-foreground">{finding.remediation}</p>
      </div>
      <div className="grid gap-2">
        <Button onClick={onRetest} disabled={busy}>
          <RotateCcw aria-hidden="true" />
          Retest with demo fix
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Retesting simulates this fix in a new full assessment. Other findings remain; the original
        evidence is preserved.
      </p>
    </>
  );
}
function EvidenceBlock({
  title,
  text,
  code = false,
}: {
  title: string;
  text: string;
  code?: boolean;
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold">{title}</h4>
      <p
        className={`rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed break-words ${code ? "font-mono" : ""}`}
      >
        {text}
      </p>
    </div>
  );
}
function StepEvidence({
  agent,
  run,
  selection,
}: {
  agent: Agent;
  run: Assessment;
  selection: Selection;
}) {
  if (selection.kind === "surface")
    return (
      <>
        <h3 className="font-semibold">Mapped attack surface</h3>
        <EvidenceBlock
          title="Observed in the demo"
          text="The connection accepted an ordinary request and returned a response. Test traces are visible; internal permissions are not independently verified."
        />
        <EvidenceBlock
          title="Unknown"
          text="Internal model instructions, unexposed tools, and cross-agent permissions remain outside the observed scope."
        />
      </>
    );
  if (selection.kind === "plan")
    return (
      <>
        <h3 className="font-semibold">Test plan</h3>
        <EvidenceBlock
          title="Assessment scope"
          text="Tests are selected from the agent’s connection, available capabilities, and observed behavior."
        />
        <EvidenceBlock
          title="Failure evidence"
          text="Check recorded responses and actions for unauthorized disclosure, tool use, or changes. Verify outcomes with observable evidence."
        />
      </>
    );
  if (selection.kind === "gap")
    return (
      <>
        <h3 className="font-semibold">Incomplete evidence</h3>
        <EvidenceBlock
          title="Observed failure"
          text="The synthetic document retrieval returned a timeout. The attack could not reach its intended input surface, so no security conclusion is available."
        />
        <EvidenceBlock
          title="Next step"
          text="Verify the document connection and permissions, then run another assessment."
        />
        <p className="text-sm text-muted-foreground">
          {run.inconclusive} attempts remain inconclusive.
        </p>
      </>
    );
  if (selection.kind === "blocked")
    return (
      <>
        <h3 className="font-semibold">Boundaries held</h3>
        <EvidenceBlock
          title="Representative blocked attempt"
          text="An untrusted message asked the agent to override its configured task and reveal a synthetic secret. The recorded response declined, and no external action was observed."
        />
        <p className="text-sm text-muted-foreground">
          {run.blocked} blocked attempts in this assessment. This result does not cover untested
          inputs or future deployments.
        </p>
      </>
    );
  return (
    <>
      <FlaskConical className="size-6 text-primary" aria-hidden="true" />
      <h3 className="font-semibold">Connection & baseline</h3>
      <EvidenceBlock title="Connection" text={`${agent.connection} · ${agent.address}`} />
      <EvidenceBlock
        title="Result"
        text="The simulated endpoint responded successfully and completed the baseline task. No real system was contacted."
      />
    </>
  );
}
