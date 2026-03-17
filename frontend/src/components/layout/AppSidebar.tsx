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
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { fetchWorkspaceNotifications } from "@/api/workspaces";

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
        <SidebarGroupLabel className="text-sidebar-muted text-[11px] uppercase tracking-wider font-medium px-2 mb-1">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
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
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar outline-none"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  >
                    <item.icon className="h-4 w-4 shrink-0 opacity-80" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{item.title}</span>
                        {showBadge && (
                          <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
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
  });
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border shadow-sm">
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-sidebar-border bg-sidebar-background">
        <span className="font-bold text-sidebar-foreground text-[18px] tracking-tight truncate">
          {collapsed ? "C" : "Consilium"}
        </span>
      </div>
      <SidebarContent className="px-2 py-3">
        <NavGroup label="Project" items={mainNav} />
        <NavGroup label="Insights" items={insightsNav} notificationUnreadCount={unreadCount} />
        <NavGroup label="System" items={systemNav} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/login"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar outline-none"
              >
                <LogOut className="h-4 w-4 shrink-0 opacity-80" />
                {!collapsed && <span>Log out</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
