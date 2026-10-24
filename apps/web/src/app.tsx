import { ThemeProvider } from "@/components/theme-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { lazy, Suspense, useEffect } from "react";
import { navigate, usePathname } from "@/lib/navigation";
import { useAgents } from "@/features/agents/use-agents";
import { AgentSetup } from "@/features/agents/setup";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

const AgentsWorkspace = lazy(() =>
  import("@/features/agents/workspace").then((module) => ({ default: module.AgentsWorkspace })),
);

export function App() {
  const pathname = usePathname();
  const agentId = pathname.startsWith("/agents/") ? pathname.split("/")[2] : undefined;
  const store = useAgents();
  const agentName = store.agents.find((agent) => agent.id === agentId)?.name;
  useEffect(() => {
    const main = document.getElementById("main");
    main?.focus({ preventScroll: true });
    main?.scrollIntoView({ block: "start" });
  }, [pathname]);
  useEffect(() => {
    document.title = `Strain · ${agentName ?? "Agents"}`;
  }, [agentName]);
  return (
    <ThemeProvider>
      <a
        href="#main"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="sr-only z-50 rounded-md bg-background p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 outline-none" id="main" tabIndex={-1}>
          <SiteHeader
            title="Agents"
            agentName={agentId ? (agentName ?? "Agent not found") : undefined}
            action={
              !agentId ? (
                <AgentSetup
                  onCreate={(config) => {
                    const id = store.addAgent(config);
                    navigate(`/agents/${id}`);
                  }}
                />
              ) : undefined
            }
          />
          <Suspense
            fallback={
              <div role="status" className="p-6 text-sm text-muted-foreground">
                Loading agents…
              </div>
            }
          >
            <AgentsWorkspace store={store} agentId={agentId} />
          </Suspense>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </ThemeProvider>
  );
}
