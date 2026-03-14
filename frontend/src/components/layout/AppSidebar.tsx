import {
  FolderKanban,
  FileText,
  Map,
  Columns3,
  Link2,
  Activity,
  BarChart3,
  AlertTriangle,
  Eye,
  Brain,
  Settings,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Requirements", slug: "requirements", icon: FolderKanban },
  { title: "PRD", slug: "prd", icon: FileText },
  { title: "Roadmap", slug: "roadmap", icon: Map },
  { title: "Kanban", slug: "kanban", icon: Columns3 },
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

function NavGroup({ label, items }: { label: string; items: typeof mainNav }) {
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
                    {!collapsed && <span>{item.title}</span>}
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

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="flex h-14 items-center gap-2.5 px-4 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary shrink-0">
          <Brain className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-sidebar-accent-foreground text-sm truncate">
            ProjectAI
          </span>
        )}
      </div>
      <SidebarContent className="px-2 py-3">
        <NavGroup label="Project" items={mainNav} />
        <NavGroup label="Insights" items={insightsNav} />
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
