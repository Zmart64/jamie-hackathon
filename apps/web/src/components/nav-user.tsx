import { CircleUserRound, EllipsisVertical, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

const user = {
  name: "Justus",
  email: "justus@carbon-zero.com",
  avatar: "/avatars/justus.png",
};

function UserAvatar() {
  return (
    <Avatar className="rounded-lg">
      <AvatarImage src={user.avatar} alt={`${user.name}'s avatar`} />
      <AvatarFallback className="rounded-lg">J</AvatarFallback>
    </Avatar>
  );
}

export function NavUser() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              aria-label="Open account menu"
              className="justify-center data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground md:justify-start"
            >
              <UserAvatar />
              <div className="hidden min-w-0 flex-1 text-left text-sm leading-tight md:grid">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <EllipsisVertical className="ml-auto hidden size-4 md:block" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side="right"
            align="end"
            sideOffset={8}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar />
                <div className="grid flex-1 leading-tight">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* These menu entries are intentionally inert prototype placeholders. */}
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <CircleUserRound aria-hidden="true" />
                Account
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut aria-hidden="true" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
