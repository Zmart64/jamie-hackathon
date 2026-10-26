import { useId, useState } from "react";
import { ChevronDown, ChevronUp, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { browserFeeds, sessionOrder } from "./recorded-run";
import { RunArtifacts, SessionEvidence } from "./session-evidence";

export function ReportSources({ elapsed }: { elapsed: number }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Files className="size-4" aria-hidden="true" />
            Source evidence
          </h2>
          <Button
            variant="outline"
            size="sm"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
            {expanded ? "Hide source evidence" : "View source evidence"}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Full conversations, tool receipts, account snapshots, and original run artifacts.
        </p>
      </CardHeader>
      {expanded && (
        <CardContent id={contentId} className="min-w-0">
          <Tabs defaultValue="conversations">
            <TabsList className="h-auto! flex-wrap">
              <TabsTrigger value="conversations">Conversations</TabsTrigger>
              <TabsTrigger value="artifacts">Run artifacts</TabsTrigger>
            </TabsList>
            <TabsContent value="conversations">
              <Tabs defaultValue="system" className="mt-3">
                <TabsList aria-label="Recorded conversations">
                  {sessionOrder.map((id, index) => (
                    <TabsTrigger key={id} value={id}>
                      S{index + 1}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {sessionOrder.map((id) => (
                  <TabsContent key={id} value={id} className="space-y-3">
                    <h3 className="text-sm font-medium">{browserFeeds[id].title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {browserFeeds[id].summary}
                    </p>
                    <SessionEvidence id={id} elapsed={elapsed} />
                  </TabsContent>
                ))}
              </Tabs>
            </TabsContent>
            <TabsContent value="artifacts">
              <RunArtifacts initial="board" />
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}
