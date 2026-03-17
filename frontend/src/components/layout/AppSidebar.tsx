import {
  FolderKanban,
  FileText,
  Map,
  Columns3,
  Link2,
  Users,
  Activity,
  BarChart3,
  AlertTriangle,
  Eye,
  Brain,
  Settings,
  LogOut,
  Orbit,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/components/NavLink";
import { useParams } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { fetchWorkspaceNotifications } from "@/api/workspaces";
import { useWorkspaceStore } from "@/store/workspaceStore";

const mainNav = [
  { title: "Requirements", slug: "requirements", icon: FolderKanban },
  { title: "PRD", slug: "prd", icon: FileText },
  { title: "Roadmap", slug: "roadmap", icon: Map },
  { title: "Kanban", slug: "kanban", icon: Columns3 },
  { title: "Team", slug: "team", icon: Users },
  { title: "Integrations", slug: "integrations", icon: Link2 },
];

const insightsNav = [
  { title: "Activity Feed", slug: "activity", icon: Activity },
  { title: "Monitoring", slug: "monitoring", icon: Eye },
  { title: "Risk Dashboard", slug: "risks", icon: AlertTriangle },
  { title: "Analytics", slug: "analytics", icon: BarChart3 },
  { title: "Agents Info", slug: "agents-info", icon: Brain },
];

const systemNav = [{ title: "Settings", slug: "settings", icon: Settings }];

function NavGroup({
  label,
  items,
  notificationUnreadCount = 0,
}: {
  label: string;
  items: typeof mainNav;
  notificationUnreadCount?: number;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { workspaceId } = useParams<{ workspaceId: string }>();

  return (
    <SidebarGroup>
      {!collapsed && (
        <SidebarGroupLabel className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-sidebar-muted">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => {
            const url = workspaceId
              ? `/dashboard/${workspaceId}/${item.slug}`
              : "/workspaces";
            const showBadge = item.slug === "activity" && notificationUnreadCount > 0;
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={url}
                    end
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/90 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    activeClassName="bg-sidebar-primary/15 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                  >
                    <item.icon className="h-4 w-4 shrink-0 opacity-80" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate font-medium">{item.title}</span>
                        {showBadge && (
                          <Badge className="h-5 min-w-5 rounded-full bg-white/10 px-1.5 text-[10px] text-white hover:bg-white/10">
                            {notificationUnreadCount}
                          </Badge>
                        )}
                      </>
                    )}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data: notifications = [] } = useQuery({
    queryKey: ["workspace-notifications", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchWorkspaceNotifications(workspaceId!),
    refetchInterval: 30_000,
  });
  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const workspace =
    activeWorkspace ?? workspaces.find((item) => item.id === workspaceId) ?? null;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/80 bg-sidebar shadow-[16px_0_60px_-38px_rgba(2,6,23,0.8)]">
      <div className="border-b border-white/5 bg-sidebar-background px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-secondary to-primary text-white shadow-lg shadow-primary/20">
            <Orbit className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[18px] font-extrabold tracking-tight text-sidebar-foreground">
                Consilium
              </p>
              <p className="truncate text-xs text-sidebar-muted">
                Autonomous project cockpit
              </p>
            </div>
          )}
        </div>

        {!collapsed && workspace && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="truncate text-sm font-semibold text-white">
              {workspace.name}
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <Badge className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/15">
                Live
              </Badge>
              <span className="text-[11px] text-sidebar-muted">
                {workspace.members.length} teammates
              </span>
            </div>
          </div>
        )}
      </div>

      <SidebarContent className="px-2 py-4">
        <NavGroup label="Project" items={mainNav} />
        <NavGroup label="Insights" items={insightsNav} notificationUnreadCount={unreadCount} />
        <NavGroup label="System" items={systemNav} />
      </SidebarContent>

      <SidebarFooter className="border-t border-white/5 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/login"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <LogOut className="h-4 w-4 shrink-0 opacity-80" />
                {!collapsed && <span className="font-medium">Log out</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
