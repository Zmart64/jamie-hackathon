import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  browserFeeds,
  formatOffset,
  recordedSessions,
  recordedStates,
  recording,
  sourceTime,
  videoOffset,
  type SessionId,
  type RecordedTool,
} from "./recorded-run";

export function EvidenceText({ text }: { text: string }) {
  return (
    <pre className="max-w-full rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
      {text}
    </pre>
  );
}

export function SessionEvidence({ id, elapsed }: { id: SessionId; elapsed: number }) {
  const session = recordedSessions[id];
  const finished = elapsed >= browserFeeds[id].end;
  const reached = (timestamp: string) =>
    finished || videoOffset(timestamp) <= sourceTime(id, elapsed);
  const turns = session.turns.filter((turn) =>
    turn.messages.some((message) => reached(message.created_at)),
  );
  const events = turns
    .flatMap((turn) => turn.tool_events)
    .filter((event) => reached(event.created_at));
  return (
    <section aria-label="Session evidence" className="min-w-0 space-y-3 border-t pt-4">
      <p className="text-xs text-muted-foreground break-all">Session {session.session_id}</p>
      <Tabs defaultValue="messages">
        <TabsList className="h-auto! w-full flex-wrap">
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="tools">Tool events</TabsTrigger>
          <TabsTrigger value="state">Account state</TabsTrigger>
        </TabsList>
        <TabsContent value="messages" className="space-y-4">
          {turns.length === 0 && (
            <p className="text-xs text-muted-foreground">Waiting for the first message.</p>
          )}
          {turns.map((turn, index) => (
            <div key={turn.turn_id} className="space-y-2">
              <h4 className="text-xs font-semibold">Turn {index + 1}</h4>
              {turn.messages
                .filter((message) => reached(message.created_at))
                .map((message) => (
                  <div key={message.id} className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      {message.role === "user" ? "Attacker" : "Sprout"} ·{" "}
                      {formatOffset(videoOffset(message.created_at))}
                    </p>
                    <EvidenceText text={message.content} />
                  </div>
                ))}
            </div>
          ))}
        </TabsContent>
        <TabsContent value="tools" className="space-y-4">
          {events.length === 0 && (
            <p className="text-xs text-muted-foreground">No tool events at this point.</p>
          )}
          {events.map((event) => (
            <ToolEvent key={event.id} event={event} />
          ))}
        </TabsContent>
        <TabsContent value="state" className="space-y-3">
          {finished ? (
            <>
              <p className="text-xs text-muted-foreground">
                Final account state and mock outbox for this conversation.
              </p>
              <EvidenceText text={JSON.stringify(recordedStates[id], null, 2)} />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              The final snapshot appears when this session finishes.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function ToolEvent({ event }: { event: RecordedTool }) {
  const afterVideo = videoOffset(event.created_at) > recording.videoSeconds;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-semibold break-all">{event.name}</h4>
        <Badge variant="outline">{event.is_error ? "Error" : "Returned"}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {formatOffset(videoOffset(event.created_at))}
        {afterVideo && " · After video ends"}
      </p>
      <EvidenceText
        text={JSON.stringify({ arguments: event.arguments, result: event.result }, null, 2)}
      />
    </div>
  );
}

export function RunArtifacts({ initial }: { initial: "board" | "toolLog" | "timeline" }) {
  return (
    <section aria-label="Run artifacts" className="min-w-0 space-y-3 border-t pt-4">
      <Tabs defaultValue={initial}>
        <TabsList className="h-auto! w-full flex-wrap">
          <TabsTrigger value="board">Message board</TabsTrigger>
          <TabsTrigger value="toolLog">Tool log</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="board" className="space-y-3">
          <p className="text-xs text-muted-foreground">
            The board includes an early incorrect inference about persistence. Each session resets
            account fixtures; the session receipts and snapshots confirm the changes.
          </p>
          <EvidenceText text={recording.board} />
        </TabsContent>
        <TabsContent value="toolLog">
          <EvidenceText text={recording.toolLog} />
        </TabsContent>
        <TabsContent value="timeline">
          <EvidenceText text={recording.timeline} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
