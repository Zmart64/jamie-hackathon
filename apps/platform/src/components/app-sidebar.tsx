import { Bot, CreditCard, KeyRound, Settings, Shield } from "lucide-react";
import { NavUser } from "@/components/nav-user";
import { AppLink } from "@/components/app-link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const companyItems = [
  { label: "Settings", icon: Settings },
  { label: "API Keys", icon: KeyRound },
  { label: "Billing", icon: CreditCard },
];

export function AppSidebar() {
  return (
    <Sidebar collapsible="none" className="sticky top-0 h-svh w-16 shrink-0 border-r md:w-64">
      <SidebarHeader className="h-16 justify-center border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              className="justify-center text-base font-semibold md:justify-start"
            >
              <AppLink href="/" aria-label="Strain home">
                <img
                  src="/brand/mark-core-ink.svg"
                  alt=""
                  className="size-8 md:hidden dark:hidden"
                />
                <img
                  src="/brand/mark-core-bone.svg"
                  alt=""
                  className="hidden size-8 dark:block md:dark:hidden"
                />
                <img
                  src="/brand/wordmark-light.svg"
                  alt=""
                  className="hidden h-6 w-auto md:block dark:md:hidden"
                />
                <img
                  src="/brand/wordmark-dark.svg"
                  alt=""
                  className="hidden h-6 w-auto dark:md:block"
                />
              </AppLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="hidden md:flex">Red Team</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Main navigation">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive
                    className="h-10 justify-center md:justify-start"
                  >
                    <AppLink href="/agents" aria-current="page" aria-label="Agents">
                      <Bot aria-hidden="true" />
                      <span className="hidden md:inline">Agents</span>
                    </AppLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel className="hidden md:flex">Security</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Security navigation">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    type="button"
                    aria-label="Agent Firewall"
                    title="Agent Firewall"
                    className="h-10 justify-center md:justify-start"
                  >
                    <Shield aria-hidden="true" />
                    <span className="hidden md:inline">Agent Firewall</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupLabel className="hidden md:flex">Company</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Company navigation">
              <SidebarMenu>
                {companyItems.map(({ label, icon: Icon }) => (
                  <SidebarMenuItem key={label}>
                    <SidebarMenuButton
                      type="button"
                      aria-label={label}
                      title={label}
                      className="h-10 justify-center md:justify-start"
                    >
                      <Icon aria-hidden="true" className="text-muted-foreground" />
                      <span className="hidden md:inline">{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
