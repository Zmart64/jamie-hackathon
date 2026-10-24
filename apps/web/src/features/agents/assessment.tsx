import { useRef, useState } from "react";
import { Check, List, LoaderCircle, Play, RotateCcw, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { AssessmentCanvas, FindingsList, type Selection } from "./canvas";
import { RunStatus } from "./controls";
import { EvidencePanel } from "./evidence";
import { AssessmentHistory } from "./history";
import { stages, type Agent, type Assessment } from "./model";
import type { AgentStore } from "./use-agents";

export function AgentAssessment({ agent, store }: { agent: Agent; store: AgentStore }) {
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("assessment");
  const run = agent.assessments.find((item) => item.id === selectedId) ?? agent.assessments[0];
  const busy = agent.assessments[0]?.state === "running";
  function start(fixedId?: string) {
    store.runAgain(agent.id, fixedId);
    setSelectedId("");
    setTab("assessment");
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
      <Tabs value={tab} onValueChange={setTab} className="gap-5">
        <TabsList className="grid h-auto! w-full grid-cols-2 gap-1 sm:flex sm:w-fit">
          <TabsTrigger className="h-8!" value="assessment">
            Assessment
          </TabsTrigger>
          <TabsTrigger className="h-8!" value="history">
            History ({agent.assessments.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="assessment" className="min-w-0 space-y-5">
          {run ? (
            <RunContent key={run.id} agent={agent} run={run} busy={busy} start={start} />
          ) : (
            <Card className="shadow-none">
              <CardContent className="grid justify-items-center gap-3 py-10 text-center">
                <Waypoints className="size-8 text-primary" aria-hidden="true" />
                <h3 className="text-lg font-semibold">Ready for its first assessment</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  We’ll check the connection, map its capabilities, and test your security
                  boundaries.
                </p>
                <Button onClick={() => start()}>Start first assessment</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="history">
          <AssessmentHistory
            agent={agent}
            onSelect={(id) => {
              setSelectedId(id);
              setTab("assessment");
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
function RunContent({
  agent,
  run,
  busy,
  start,
}: {
  agent: Agent;
  run: Assessment;
  busy: boolean;
  start: (id?: string) => void;
}) {
  if (run.state === "running") return <ScanProgress run={run} />;
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
  return <AssessmentExplorer agent={agent} run={run} busy={busy} start={start} />;
}
function AssessmentExplorer({
  agent,
  run,
  busy,
  start,
}: {
  agent: Agent;
  run: Assessment;
  busy: boolean;
  start: (id?: string) => void;
}) {
  const [view, setView] = useState("canvas");
  const [inspecting, setInspecting] = useState(false);
  const inspectionTrigger = useRef<HTMLElement | null>(null);
  const [selection, setSelection] = useState<Selection>(() =>
    run.findings[0] ? { kind: "finding", findingId: run.findings[0].id } : { kind: "baseline" },
  );
  return (
    <>
      {run.state === "incomplete" && (
        <p
          role="status"
          className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground"
        >
          Assessment incomplete: document retrieval failed. Review the coverage gaps below before
          interpreting the results.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border p-1">
          <Button
            size="sm"
            variant={view === "canvas" ? "secondary" : "ghost"}
            aria-pressed={view === "canvas"}
            onClick={() => setView("canvas")}
          >
            <Waypoints aria-hidden="true" />
            Canvas
          </Button>
          <Button
            size="sm"
            variant={view === "findings" ? "secondary" : "ghost"}
            aria-pressed={view === "findings"}
            onClick={() => setView("findings")}
          >
            <List aria-hidden="true" />
            Findings
          </Button>
        </div>
      </div>
      {view === "canvas" ? (
        <>
          <AssessmentCanvas
            run={run}
            selection={selection}
            onSelect={(next) => {
              inspectionTrigger.current = document.activeElement as HTMLElement;
              setSelection(next);
              setInspecting(true);
            }}
          />
          <Sheet open={inspecting} onOpenChange={setInspecting}>
            <SheetContent
              className="w-full overflow-y-auto sm:max-w-md"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                inspectionTrigger.current?.focus();
              }}
            >
              <SheetHeader>
                <SheetTitle>Step details</SheetTitle>
                <SheetDescription>Recorded evidence from this assessment.</SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-4">
                <EvidencePanel
                  agent={agent}
                  run={run}
                  selection={selection}
                  onRetest={start}
                  busy={busy}
                />
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <div className="grid min-w-0 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_320px]">
          <FindingsList run={run} selection={selection} onSelect={setSelection} />
          <EvidencePanel
            agent={agent}
            run={run}
            selection={selection}
            onRetest={start}
            busy={busy}
          />
        </div>
      )}
    </>
  );
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
