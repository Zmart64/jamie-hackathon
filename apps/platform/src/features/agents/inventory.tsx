import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLink } from "@/components/app-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RunStatus } from "./controls";
import { severities, type Agent } from "./model";
import { SeverityLabel } from "./severity";

export function AgentInventory({ agents }: { agents: Agent[] }) {
  const [query, setQuery] = useState("");
  const filtered = agents.filter((agent) => agent.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label="Agent inventory">
      <div className="grid gap-3 border-b p-4 sm:flex sm:flex-wrap sm:items-end">
        <div className="grid min-w-0 flex-1 gap-2 sm:min-w-48">
          <Label htmlFor="agent-search">Search agents</Label>
          <div className="relative">
            <Search
              className="absolute top-2.5 left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="agent-search"
              placeholder="Search agents…"
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="pl-5">Agent</TableHead>
            <TableHead>Latest assessment</TableHead>
            <TableHead>Findings</TableHead>
            <TableHead>Last tested</TableHead>
            <TableHead>
              <span className="sr-only">Open</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((agent) => (
            <AgentRow key={agent.id} agent={agent} />
          ))}
        </TableBody>
      </Table>
      {filtered.length === 0 && (
        <div className="grid justify-items-center gap-3 px-4 py-16 text-center">
          <Search className="size-7 text-muted-foreground" aria-hidden="true" />
          <h3 className="font-medium">No agents match your search</h3>
          <p className="text-sm text-muted-foreground">
            Try another name or clear the search to see all agents.
          </p>
          <Button variant="outline" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      )}
    </section>
  );
}
function AgentRow({ agent }: { agent: Agent }) {
  const run = agent.assessments[0];
  const findings = run?.findings ?? [];
  const counts = severities
    .map((severity) => ({
      severity,
      count: findings.filter((finding) => finding.severity === severity).length,
    }))
    .filter(({ count }) => count > 0);
  return (
    // The name link stretches over the whole row, so the row is one click target
    // with a single accessible link (Cmd/middle-click still open a new tab).
    <TableRow className="group relative">
      <TableCell className="py-5 pl-5">
        <AppLink
          href={`/agents/${agent.id}`}
          className="font-medium outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset"
        >
          {agent.name}
        </AppLink>
      </TableCell>
      <TableCell>
        <RunStatus run={run} />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {counts.map(({ severity, count }) => (
            <SeverityLabel key={severity} severity={severity} count={count} />
          ))}
          {counts.length === 0 && (
            <span className="text-muted-foreground">{findingSummary(run)}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{run?.date ?? "—"}</TableCell>
      <TableCell className="pr-4">
        <ArrowRight
          className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none"
          aria-hidden="true"
        />
      </TableCell>
    </TableRow>
  );
}
function findingSummary(run: Agent["assessments"][number] | undefined): string {
  if (!run) return "—";
  if (run.state === "complete") return "None";
  return "Pending";
}
