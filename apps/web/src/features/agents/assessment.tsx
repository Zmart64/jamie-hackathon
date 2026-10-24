import { useRef, useState } from "react";
import { Check, List, LoaderCircle, Play, RotateCcw, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AssessmentCanvas, FindingsList, type Selection } from "./canvas";
import { RunStatus } from "./controls";
import { EvidencePanel } from "./evidence";
import { AssessmentHistory } from "./history";
import { stages, type Agent, type Assessment } from "./model";
import type { AgentStore } from "./use-agents";

type AssessmentView = "canvas" | "findings";

export function AgentAssessment({ agent, store }: { agent: Agent; store: AgentStore }) {
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("assessment");
  const [view, setView] = useState<AssessmentView>("canvas");
  const run = agent.assessments.find((item) => item.id === selectedId) ?? agent.assessments[0];
  const busy = agent.assessments[0]?.state === "running";
  function start() {
    store.runAgain(agent.id);
    setSelectedId("");
    setTab("assessment");
    setView("canvas");
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight break-words">{agent.name}</h1>
        <Button disabled={busy} onClick={() => start()}>
          {busy ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Play aria-hidden="true" />
          )}
          {busy ? "Assessment running" : "Run assessment"}
        </Button>
      </div>
      <Tabs
        value={tab}
        onValueChange={(next) => {
          setTab(next);
          setView("canvas");
        }}
        className="gap-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="h-10! gap-1">
            <TabsTrigger className="h-8!" value="assessment">
              Assessment
            </TabsTrigger>
            <TabsTrigger className="h-8!" value="history">
              History ({agent.assessments.length})
            </TabsTrigger>
          </TabsList>
          {tab === "assessment" && hasExplorer(run) && (
            <AssessmentViewToggle view={view} onChange={setView} />
          )}
        </div>
        <TabsContent value="assessment" className="min-w-0 space-y-5">
          {run ? (
            <RunContent
              key={run.id}
              agent={agent}
              run={run}
              busy={busy}
              start={start}
              view={view}
            />
          ) : (
            <AssessmentExplorer
              agent={agent}
              run={undefined}
              busy={false}
              start={start}
              view={view}
            />
          )}
        </TabsContent>
        <TabsContent value="history">
          <AssessmentHistory
            agent={agent}
            onSelect={(id) => {
              setSelectedId(id);
              setTab("assessment");
              setView("canvas");
            }}
          />
          {agent.assessments.length === 0 && (
            <p className="py-8 text-sm text-muted-foreground">
              No assessments yet. Start the first one from the Assessment tab.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
function hasExplorer(run: Assessment | undefined): boolean {
  return run?.state !== "failed" && (run?.state !== "running" || Boolean(run.demo));
}
function AssessmentViewToggle({
  view,
  onChange,
}: {
  view: AssessmentView;
  onChange: (view: AssessmentView) => void;
}) {
  return (
    <div className="ml-auto flex h-10 shrink-0 items-center gap-1 rounded-lg border p-[3px]">
      <Button
        size="sm"
        variant={view === "canvas" ? "secondary" : "ghost"}
        aria-pressed={view === "canvas"}
        onClick={() => onChange("canvas")}
      >
        <Waypoints aria-hidden="true" />
        Canvas
      </Button>
      <Button
        size="sm"
        variant={view === "findings" ? "secondary" : "ghost"}
        aria-pressed={view === "findings"}
        onClick={() => onChange("findings")}
      >
        <List aria-hidden="true" />
        Findings
      </Button>
    </div>
  );
}
function RunContent({
  agent,
  run,
  busy,
  start,
  view,
}: {
  agent: Agent;
  run: Assessment;
  busy: boolean;
  start: (id?: string) => void;
  view: AssessmentView;
}) {
  if (run.state === "running" && !run.demo) return <ScanProgress run={run} />;
  if (run.state === "failed")
    return (
      <Card className="border-destructive/30 shadow-none">
        <CardContent className="space-y-4">
          <RunStatus run={run} />
          <h3 className="text-lg font-semibold">We couldn’t reach this agent</h3>
          <p className="text-sm text-muted-foreground">
            The sample endpoint timed out during the connection check. No attacks ran and no
            security conclusion is available.
          </p>
          <p className="text-xs text-muted-foreground">
            In this demo, retrying simulates a restored connection.
          </p>
          <Button disabled={busy} onClick={() => start()}>
            <RotateCcw aria-hidden="true" />
            Retry demo connection
          </Button>
        </CardContent>
      </Card>
    );
  return <AssessmentExplorer agent={agent} run={run} busy={busy} start={start} view={view} />;
}
function AssessmentExplorer({
  agent,
  run,
  busy,
  start,
  view,
}: {
  agent: Agent;
  run: Assessment | undefined;
  busy: boolean;
  start: (id?: string) => void;
  view: AssessmentView;
}) {
  const [inspecting, setInspecting] = useState(false);
  const inspectionTrigger = useRef<HTMLElement | null>(null);
  const [selection, setSelection] = useState<Selection>(() =>
    run?.findings[0] ? { kind: "finding", findingId: run.findings[0].id } : { kind: "baseline" },
  );
  const findingsSelection = selectFinding(run, selection);
  const evidence = (
    <EvidencePanel
      agent={agent}
      run={run}
      selection={view === "findings" ? findingsSelection : selection}
      onRetest={start}
      busy={busy}
    />
  );
  return (
    <>
      {run?.state === "incomplete" && (
        <p
          role="status"
          className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
        >
          Assessment incomplete: document retrieval failed. Review the coverage gaps below before
          interpreting the results.
        </p>
      )}
      {view === "canvas" ? (
        <AssessmentCanvas
          run={run}
          selection={selection}
          onSelect={(next) => {
            inspectionTrigger.current = document.activeElement as HTMLElement;
            setSelection(next);
            setInspecting(true);
          }}
          details={
            inspecting
              ? {
                  content: evidence,
                  onClose: () => {
                    setInspecting(false);
                    inspectionTrigger.current?.focus({ preventScroll: true });
                  },
                }
              : undefined
          }
        />
      ) : (
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_320px]">
          <FindingsList run={run} selection={findingsSelection} onSelect={setSelection} />
          {showFindingsEvidence(run, selection) && evidence}
        </div>
      )}
    </>
  );
}
function selectFinding(run: Assessment | undefined, selection: Selection): Selection {
  if (selection.findingId || selection.kind === "gap") return selection;
  const finding = run?.findings[0];
  return finding ? { kind: "finding", findingId: finding.id } : selection;
}
function showFindingsEvidence(run: Assessment | undefined, selection: Selection): boolean {
  return Boolean(run && (run.findings.length > 0 || selection.kind === "gap"));
}
function ScanProgress({ run }: { run: Assessment }) {
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-6 py-3">
        <div className="flex items-center gap-3">
          <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden="true" />
          <div>
            <h3 className="font-semibold">Exploring your agent’s boundaries</h3>
            <p className="mt-1 text-sm text-muted-foreground" role="status">
              {stages[run.stage]} · Simulated assessment
            </p>
          </div>
        </div>
        <Progress value={(run.stage + 1) * 20} aria-label="Assessment progress" />
        <ol className="space-y-3">
          {stages.map((stage, index) => (
            <li key={stage} className="flex items-center gap-3 text-sm">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs ${index <= run.stage ? "border-primary/30 bg-primary/10 text-primary" : "text-muted-foreground"}`}
              >
                {index < run.stage ? <Check className="size-3" aria-hidden="true" /> : index + 1}
              </span>
              <span className={index > run.stage ? "text-muted-foreground" : ""}>{stage}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {stageState(index, run.stage)}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          You can leave this page. The demo continues in this session and preserves previous
          assessments.
        </p>
      </CardContent>
    </Card>
  );
}
function stageState(index: number, active: number): string {
  if (index < active) return "Complete";
  return index === active ? "Running" : "Queued";
}
