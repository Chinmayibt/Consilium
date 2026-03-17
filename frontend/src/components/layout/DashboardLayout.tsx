import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet, useParams } from "react-router-dom";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Clock } from "@/components/Clock";
import { ProjectInsightBot } from "@/components/ProjectInsightBot";

export function DashboardLayout() {
  const user = useAuthStore((s) => s.user);
  const initials =
    user?.avatar_initials ?? user?.name?.slice(0, 2).toUpperCase() ?? "CN";
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const inferredWorkspace =
    activeWorkspace ??
    workspaces.find((w) => w.id === workspaceId) ??
    null;
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border/80 bg-background/95 backdrop-blur-sm px-4 lg:px-6">
            <SidebarTrigger
              className="text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors"
              aria-label="Toggle sidebar"
            />
            <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                {inferredWorkspace && (
                  <p className="text-sm font-medium truncate">
                    {inferredWorkspace.name}
                  </p>
                )}
              </div>
              <div className="relative hidden md:flex items-center gap-3 w-full max-w-[320px]">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Search..."
                    className="pl-9 h-9 rounded-lg bg-muted/60 border-0 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </div>
                <Clock />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
              </Button>
              <Avatar className="h-8 w-8 rounded-lg shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium rounded-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
          <ProjectInsightBot />
        </div>
      </div>
    </SidebarProvider>
  );
}
