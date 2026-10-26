import { ArrowLeft, FileSearch } from "lucide-react";
import { AppLink } from "@/components/app-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FindingReport } from "./finding-report";
import { severities, type Agent, type Assessment } from "./model";
import { ReportSources } from "./report-sources";
import { assessmentPath, findingsPath } from "./routes";
import { SeverityLabel } from "./severity";

export function FindingsPage({
  agent,
  assessmentId,
}: {
  agent: Agent;
  assessmentId: string | undefined;
}) {
  const run = assessmentId
    ? agent.assessments.find((item) => item.id === assessmentId)
    : agent.assessments[0];
  const missing = Boolean(assessmentId && !run);
  return (
    <div className="mx-auto max-w-6xl space-y-8 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Findings</h1>
          {run && (
            <p className="font-mono text-xs text-muted-foreground">
              {run.id} · {run.date}
            </p>
          )}
        </div>
        <Button asChild variant="outline">
          <AppLink href={assessmentPath(agent.id, run?.id)}>
            <ArrowLeft aria-hidden="true" />
            Back to assessment
          </AppLink>
        </Button>
      </div>
      {missing ? (
        <Card className="shadow-none">
          <CardContent className="space-y-3">
            <h2 className="text-lg font-semibold">Assessment not found</h2>
            <p className="text-sm text-muted-foreground">
              This assessment is no longer available. Demo runs created in this session reset on
              refresh.
            </p>
            <Button asChild variant="outline">
              <AppLink href={findingsPath(agent.id)}>View latest findings</AppLink>
            </Button>
          </CardContent>
        </Card>
      ) : run ? (
        <ReportBody run={run} />
      ) : (
        <ReportEmpty run={undefined} />
      )}
    </div>
  );
}

function ReportBody({ run }: { run: Assessment }) {
  const findings = [...run.findings].sort(
    (a, b) => severities.indexOf(a.severity) - severities.indexOf(b.severity),
  );
  return (
    <>
      <ReportOverview run={run} />
      {run.state === "running" && (
        <p
          role="status"
          className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
        >
          Assessment running. Findings appear as evidence is verified; this report is still in
          progress.
        </p>
      )}
      {findings.length > 0 ? (
        <section aria-labelledby="findings-title" className="space-y-4">
          <h2 id="findings-title" className="text-lg font-semibold">
            Findings ({findings.length})
          </h2>
          <ol aria-label="Findings by severity" className="space-y-4">
            {findings.map((finding, index) => (
              <li key={finding.id}>
                <FindingReport finding={finding} index={index} recorded={Boolean(run.demo)} />
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <ReportEmpty run={run} />
      )}
      {run.demo && findings.length > 0 && <ReportSources elapsed={run.demo.elapsedMs} />}
      {!run.demo && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Sample assessment with simulated API traces. Internal model reasoning and browser
          screenshots are unavailable. Results describe only the tested scope.
        </p>
      )}
    </>
  );
}

function ReportOverview({ run }: { run: Assessment }) {
  const findings = run.findings;
  return (
    <section aria-label="Assessment overview">
      <dl className="grid gap-3 sm:grid-cols-3">
        {severities.map((severity) => (
          <div key={severity} className="rounded-xl border bg-card p-4">
            <dt>
              <SeverityLabel severity={severity} />
            </dt>
            <dd className="mt-3 text-3xl font-semibold tabular-nums">
              {findings.filter((finding) => finding.severity === severity).length}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ReportEmpty({ run }: { run: Assessment | undefined }) {
  const content = emptyContent(run);
  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center">
      <FileSearch className="mx-auto mb-4 size-7 text-muted-foreground" aria-hidden="true" />
      <h2 className="font-semibold">{content.title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
        {content.text}
      </p>
    </div>
  );
}

function emptyContent(run: Assessment | undefined): { title: string; text: string } {
  if (!run)
    return {
      title: "No findings yet.",
      text: "Start an assessment from the agent page to explore its security boundaries.",
    };
  if (run.state === "failed")
    return {
      title: "Assessment could not run",
      text: "The connection failed before any attacks ran. No security conclusion is available. Return to the assessment to retry the connection.",
    };
  if (run.state === "running")
    return {
      title: "No findings yet.",
      text: "The assessment is still collecting and verifying evidence. You can return to the canvas to follow its progress.",
    };
  if (run.state === "incomplete")
    return {
      title: "No confirmed findings",
      text: "This assessment is incomplete. Return to the assessment to review its progress.",
    };
  return {
    title: "No findings in tested scope",
    text: "No vulnerabilities were confirmed in the completed tests. This result does not cover untested inputs or future deployments.",
  };
}
