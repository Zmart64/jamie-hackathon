import { ThemeProvider } from "@/components/theme-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { lazy, Suspense } from "react";
import { DataTable } from "@/components/data-table";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

const ChartAreaInteractive = lazy(() =>
  import("@/components/chart-area-interactive").then((module) => ({
    default: module.ChartAreaInteractive,
  })),
);

export function App() {
  return (
    <ThemeProvider>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0" id="main" tabIndex={-1}>
          <SiteHeader />
          <div className="@container/main flex flex-1 flex-col gap-6 py-6">
            <SectionCards />
            <div className="px-4 lg:px-6">
              <Suspense
                fallback={
                  <div
                    role="status"
                    className="flex h-88 items-center justify-center rounded-xl border text-sm text-muted-foreground"
                  >
                    Loading visitor chart…
                  </div>
                }
              >
                <ChartAreaInteractive />
              </Suspense>
            </div>
            <DataTable />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster />
    </ThemeProvider>
  );
}
