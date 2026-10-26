import type { ReactNode } from "react";
import { AppLink } from "@/components/app-link";
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
  agentHref,
  findings = false,
  action,
}: {
  title: string;
  agentName: string | undefined;
  agentHref?: string | undefined;
  findings?: boolean;
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
              {findings && agentHref ? (
                <BreadcrumbLink asChild className="truncate" title={agentName}>
                  <AppLink href={agentHref}>{agentName}</AppLink>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="truncate font-medium" title={agentName}>
                  {agentName}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {findings && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="shrink-0">
                  <BreadcrumbPage className="font-medium">Findings</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      ) : (
        <h1 className="text-sm font-medium">{title}</h1>
      )}
      {action && <div className="ml-auto shrink-0">{action}</div>}
    </header>
  );
}
