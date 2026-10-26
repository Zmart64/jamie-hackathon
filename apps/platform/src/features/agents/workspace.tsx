import { Button } from "@/components/ui/button";
import { AppLink } from "@/components/app-link";
import { AgentInventory } from "./inventory";
import { AgentAssessment } from "./assessment";
import { FindingsPage } from "./findings-page";
import type { AgentStore } from "./use-agents";

export function AgentsWorkspace({
  store,
  agentId,
  assessmentId,
  findings,
}: {
  store: AgentStore;
  agentId: string | undefined;
  assessmentId: string | undefined;
  findings: boolean;
}) {
  const agent = store.agents.find((item) => item.id === agentId);
  return (
    <div className="min-w-0 space-y-6 px-4 py-6 lg:px-6">
      {agentId && !agent ? (
        <div className="grid justify-items-center gap-3 py-16 text-center">
          <h2 className="text-xl font-semibold">Agent not found</h2>
          <p className="text-sm text-muted-foreground">
            Demo agents added in a previous session reset when the page refreshes.
          </p>
          <Button asChild variant="outline">
            <AppLink href="/agents">Back to agents</AppLink>
          </Button>
        </div>
      ) : agent ? (
        findings ? (
          <FindingsPage
            key={`${agent.id}-${assessmentId}`}
            agent={agent}
            assessmentId={assessmentId}
          />
        ) : (
          <AgentAssessment
            key={`${agent.id}-${assessmentId}`}
            agent={agent}
            store={store}
            assessmentId={assessmentId}
          />
        )
      ) : (
        <AgentInventory agents={store.agents} />
      )}
    </div>
  );
}
