import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RunStatus } from "./controls";
import type { Agent } from "./model";

export function AssessmentHistory({
  agent,
  onSelect,
}: {
  agent: Agent;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {agent.assessments.map((run, index) => (
        <Card key={run.id} className="gap-0 py-4 shadow-none">
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-medium">{run.id}</span>
                {index === 0 && <Badge variant="secondary">Latest</Badge>}
                <RunStatus run={run} />
              </div>
              <p className="text-xs text-muted-foreground">
                {run.date} · {run.tests} attempts · {run.findings.length} findings
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onSelect(run.id)}>
              View assessment
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
