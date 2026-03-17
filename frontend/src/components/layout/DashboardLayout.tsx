import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet, useNavigate, useParams } from "react-router-dom";
import { Bell, Search, Sparkles, Radio, AlertTriangle, CheckCircle2, GitCommitHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Clock } from "@/components/Clock";
import { ProjectInsightBot } from "@/components/ProjectInsightBot";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchNotifications, markNotificationsRead } from "@/api/workspaces";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function formatTimestamp(ts?: string) {
  if (!ts) return "Recently";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function notificationIcon(type?: string) {
  switch (type) {
    case "risk":
    case "blocker":
      return AlertTriangle;
    case "replanning":
    case "project_completed":
      return CheckCircle2;
    case "commit":
    case "task":
      return GitCommitHorizontal;
    default:
      return Bell;
  }
}

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
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notificationData } = useQuery({
    queryKey: ["global-notifications"],
    queryFn: fetchNotifications,
    refetchInterval: 10_000,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-notifications"] });
    },
  });

  const notifications = notificationData?.notifications ?? [];
  const unreadCount = notificationData?.unread_count ?? 0;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-transparent">
        <AppSidebar />
        <div className="relative flex-1 min-w-0">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-[-8rem] top-[-10rem] h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />
            <div className="absolute right-[-6rem] top-10 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
          </div>

          <div className="relative flex min-h-screen flex-col">
            <header className="sticky top-0 z-30 px-4 pt-4 lg:px-6 lg:pt-6">
              <div className="hero-panel flex min-h-[76px] items-center gap-4 px-4 py-3 lg:px-5">
                <SidebarTrigger
                  className="rounded-xl border border-border/60 bg-white/70 text-muted-foreground hover:bg-white hover:text-foreground"
                  aria-label="Toggle sidebar"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10">
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      AI Project Control
                    </Badge>
                    <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                      <Radio className="mr-1 h-3.5 w-3.5" />
                      Live workspace
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-extrabold tracking-tight text-slate-900">
                        {inferredWorkspace?.name ?? "Workspace dashboard"}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {inferredWorkspace?.description || "Monitoring, planning, and agent signals in one place."}
                      </p>
                    </div>

                    <div className="hidden min-w-[260px] items-center gap-3 md:flex">
                      <div className="relative flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search tasks, risks, updates"
                          className="h-10 rounded-xl border-white/60 bg-white/70 pl-9 shadow-sm"
                        />
                      </div>
                      <Clock />
                    </div>
                  </div>
                </div>

                <DropdownMenu
                  onOpenChange={(open) => {
                    if (open && unreadCount > 0 && !markReadMutation.isPending) {
                      markReadMutation.mutate();
                    }
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-10 w-10 rounded-xl border border-border/60 bg-white/70 text-muted-foreground hover:bg-white hover:text-foreground"
                      aria-label="Notifications"
                    >
                      <Bell className="h-4 w-4" />
                      {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[360px] rounded-2xl border-white/60 bg-white/95 p-0 shadow-2xl">
                    <DropdownMenuLabel className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">Notifications</p>
                          <p className="text-xs text-muted-foreground">Latest meaningful events only</p>
                        </div>
                        <Badge className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary hover:bg-primary/10">
                          {unreadCount} unread
                        </Badge>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="max-h-[420px] overflow-y-auto p-2">
                      {notifications.length === 0 ? (
                        <div className="rounded-2xl p-4 text-sm text-muted-foreground">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map((notification) => {
                          const Icon = notificationIcon(notification.type);
                          return (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => {
                                if (notification.workspace_id) {
                                  navigate(`/dashboard/${notification.workspace_id}/activity`);
                                }
                              }}
                              className="flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-slate-50"
                            >
                              <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900">
                                  {notification.message ?? "Notification"}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {notification.workspace_name ? `${notification.workspace_name} · ` : ""}
                                  {formatTimestamp(notification.created_at)}
                                </p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Avatar className="h-10 w-10 rounded-2xl border border-white/70 shadow-sm">
                  <AvatarFallback className="rounded-2xl bg-slate-900 text-xs font-bold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            </header>

            <main className="flex-1 overflow-auto pb-10">
              <Outlet />
            </main>
            <ProjectInsightBot />
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
