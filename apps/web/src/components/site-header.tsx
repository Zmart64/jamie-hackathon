import type { ReactNode } from "react";
import { AppLink } from "@/components/app-link";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export function SiteHeader({
  title,
  agentName,
  action,
}: {
  title: string;
  agentName: string | undefined;
  action?: ReactNode;
}) {
  return (
    <header className="flex h-16 min-w-0 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
      {agentName ? (
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem className="shrink-0">
              <BreadcrumbLink asChild>
                <AppLink href="/agents">Agents</AppLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate" title={agentName}>
                {agentName}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      ) : (
        <h1 className="text-lg font-semibold">{title}</h1>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ThemeToggle />
        {action}
      </div>
    </header>
  );
}
