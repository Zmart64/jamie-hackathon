import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Assessment, Finding } from "./model";
import type { Selection } from "./canvas-model";
import { demoSteps, type DemoStep } from "./demo-graph";
import { browserFeeds } from "./demo";

export function DemoEvidence({ run, selection }: { run: Assessment; selection: Selection }) {
  const finding = run.findings.find((item) => item.id === selection.findingId);
  if (finding) return <DemoFindingEvidence finding={finding} />;
  const step = demoSteps.find((item) => item.id === selection.stepId) ?? demoSteps[0];
  if (!step) return null;
  return <DemoStepEvidence step={step} elapsed={run.demo?.elapsedMs ?? 0} />;
}

function DemoStepEvidence({ step, elapsed }: { step: DemoStep; elapsed: number }) {
  const running = elapsed < step.until;
  return (
    <Card className="gap-4 shadow-none">
      <CardHeader>
        <CardTitle className="text-base leading-relaxed">
          <h3>{step.label}</h3>
        </CardTitle>
        <Badge variant="outline" className="w-fit">
          {running ? "Running" : step.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">
          {running
            ? "This step is in progress."
            : step.feed
              ? browserFeeds[step.feed].summary
              : step.description}
        </p>
        {!running && step.details?.map((detail) => <Detail key={detail.title} {...detail} />)}
      </CardContent>
    </Card>
  );
}

function DemoFindingEvidence({ finding }: { finding: Finding }) {
  return (
    <Card className="gap-4 shadow-none">
      <CardHeader>
        <CardTitle className="text-base leading-relaxed">
          <h3>{finding.title}</h3>
        </CardTitle>
        <Badge variant="destructive" className="w-fit">
          {finding.severity}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">{finding.impact}</p>
        <Detail title="Submitted request" text={finding.input} />
        <Detail title="Tool action" text={finding.action} />
        <Detail title="Verification evidence" text={finding.evidence} />
        <Detail title="Suggested remediation" text={finding.remediation} />
      </CardContent>
    </Card>
  );
}

function Detail({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold">{title}</h4>
      <p className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed break-words">
        {text}
      </p>
    </div>
  );
}
