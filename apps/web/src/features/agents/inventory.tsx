import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { type Agent } from "./model";

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
  const high = findings.filter((finding) => finding.severity === "High").length;
  const medium = findings.filter((finding) => finding.severity === "Medium").length;
  return (
    <TableRow>
      <TableCell className="py-5 pl-5">
        <AppLink
          href={`/agents/${agent.id}`}
          className="rounded-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {agent.name}
        </AppLink>
      </TableCell>
      <TableCell>
        <RunStatus run={run} />
      </TableCell>
      <TableCell>
        <div className="flex gap-1.5">
          {high > 0 && <Badge variant="destructive">{high} high</Badge>}
          {medium > 0 && <Badge variant="secondary">{medium} medium</Badge>}
          {high + medium === 0 && (
            <span className="text-muted-foreground">{findingSummary(run)}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{run?.date ?? "—"}</TableCell>
      <TableCell className="pr-4">
        <Button asChild variant="ghost" size="icon-sm">
          <AppLink href={`/agents/${agent.id}`} aria-label={`Open ${agent.name}`}>
            <ArrowRight aria-hidden="true" />
          </AppLink>
        </Button>
      </TableCell>
    </TableRow>
  );
}
function findingSummary(run: Agent["assessments"][number] | undefined): string {
  if (!run) return "—";
  if (run.state === "complete") return "None";
  return "Pending";
}
