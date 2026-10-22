import { useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  FlaskConical,
  Layers2,
  RotateCcw,
  Search,
  Shield,
  Ticket,
} from "lucide-react";
import { Badge } from "@/components/base/badges/badge";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { SampleTrace } from "@/components/sample-trace";

export function App() {
  const [query, setQuery] = useState("");
  const [showTrace, setShowTrace] = useState(false);
  const matches = "refund policy bypass support agent".includes(query.trim().toLowerCase());

  function reset() {
    setQuery("");
    setShowTrace(false);
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[216px_1fr]">
      <a
        href="#main"
        className="sr-only z-10 rounded-md bg-primary p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <aside className="flex flex-col border-b bg-secondary px-4 py-5 md:sticky md:top-0 md:h-dvh md:border-r md:border-b-0">
        <div className="flex items-center gap-2 px-2 font-semibold tracking-tight">
          <Shield aria-hidden="true" />
          strain
          <span className="ml-auto text-xs font-normal tracking-normal text-tertiary">
            Prototype
          </span>
        </div>
        <nav aria-label="Workspace" className="mt-6">
          <a
            href="#main"
            aria-current="page"
            className="flex items-center gap-2 rounded-md bg-secondary px-3 py-2 font-medium"
          >
            <Layers2 aria-hidden="true" />
            Scenarios
          </a>
        </nav>
        <div className="mt-auto hidden px-2 pt-8 md:block">
          <p className="flex items-center gap-2 text-xs font-medium">
            <FlaskConical aria-hidden="true" />
            Concept workspace
          </p>
          <p className="mt-2 text-xs leading-5 text-tertiary">
            A place to explore agent security.
            <br />
            All evidence is illustrative.
          </p>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex h-14 items-center gap-2 border-b px-6 text-xs text-tertiary md:px-10">
          Workspace
          <ChevronRight aria-hidden="true" />
          <span className="text-primary">Scenarios</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-warning-solid" />
            Sample data
          </span>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto max-w-5xl px-6 py-10 outline-none md:px-10 md:py-14"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-3 text-xs font-medium tracking-wide text-tertiary">AGENT SECURITY</p>
              <h1 className="text-3xl font-semibold tracking-tight">Scenarios</h1>
              <p className="mt-3 max-w-xl text-tertiary">
                Follow an attack from an untrusted instruction to its consequence.
              </p>
            </div>
            <Button color="secondary" onPress={reset}>
              <RotateCcw aria-hidden="true" />
              Reset view
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <h2 className="font-medium">
              Sample scenarios <span className="ml-2 text-xs text-tertiary">1</span>
            </h2>
            <div className="relative w-full sm:w-60">
              <Input
                label="Search scenarios"
                placeholder="Search scenarios…"
                value={query}
                onChange={(value) => {
                  setQuery(value);
                  setShowTrace(false);
                }}
                icon={Search}
              />
            </div>
          </div>
          {matches ? (
            <article className="mt-6 rounded-xl border bg-primary">
              <div className="p-5 md:p-6">
                <div className="flex items-center gap-2 text-xs text-tertiary">
                  <Ticket aria-hidden="true" />
                  Support agent<span aria-hidden="true">·</span>Tool permissions
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <h3 className="text-lg font-semibold tracking-tight">Refund policy bypass</h3>
                  <Badge color="gray">Illustrative</Badge>
                </div>
                <p className="mt-2 max-w-xl leading-6 text-tertiary">
                  A manipulated support ticket asks an agent to issue a refund outside its approval
                  policy.
                </p>
                <dl className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-tertiary">Entry point</dt>
                    <dd className="mt-1">Support ticket</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tertiary">Action at risk</dt>
                    <dd className="mt-1">Issue a refund</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-tertiary">Policy</dt>
                    <dd className="mt-1">Approval above €100</dd>
                  </div>
                </dl>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 border-t px-5 py-4 md:px-6">
                <p className="text-xs text-tertiary">Inspect the failure and a proposed control.</p>
                <Button
                  aria-expanded={showTrace}
                  aria-controls="sample-trace"
                  onPress={() => setShowTrace(!showTrace)}
                >
                  {showTrace ? "Hide sample trace" : "View sample trace"}
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
              <div id="sample-trace">{showTrace && <SampleTrace />}</div>
            </article>
          ) : (
            <div role="status" className="py-16 text-center">
              <Search aria-hidden="true" className="mx-auto text-tertiary" />
              <h3 className="mt-4 font-medium">No matching scenarios</h3>
              <p className="mt-2 text-tertiary">Try “refund” or clear your search.</p>
              <Button color="secondary" className="mt-4" onPress={reset}>
                Clear search
              </Button>
            </div>
          )}
          <p className="mt-6 text-xs text-tertiary">
            Concept preview · Sample data only · No live actions
          </p>
        </main>
      </div>
    </div>
  );
}
