import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  MessageSquare,
  Radio,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchWorkspaceNotifications,
  fetchWorkspaceActivity,
  markWorkspaceNotificationsRead,
  type ActivityLogEntry,
  type WorkspaceNotification,
} from "@/api/workspaces";

function iconForAction(action: string) {
  switch (action) {
    case "TASK_CREATED":
    case "TASK_ASSIGNED":
      return Activity;
    case "RISK_ADDED":
    case "RISK_UPDATED":
      return AlertTriangle;
    case "REPLANNING_TRIGGERED":
    case "PROJECT_COMPLETED":
      return CheckCircle2;
    case "TEAM_MEMBER_ADDED":
      return MessageSquare;
    default:
      return Activity;
  }
}

function iconForNotificationType(type: string | undefined) {
  switch (type) {
    case "risk":
    case "blocker":
      return AlertTriangle;
    case "project_completed":
    case "replanning":
      return CheckCircle2;
    default:
      return Bell;
  }
}

function colorForSeverity(severity: string | undefined) {
  switch (severity) {
    case "high":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function formatTimestamp(ts: string) {
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60_000) return "Just now";
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
    return d.toLocaleDateString();
  } catch {
    return ts;
  }
}

function TimelineItem({
  icon: Icon,
  title,
  meta,
  badge,
  tone,
}: {
  icon: typeof Activity;
  title: string;
  meta: string;
  badge?: string;
  tone?: string;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-border/70 bg-slate-50/80 p-4">
      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tone || "bg-primary/10 text-primary"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          {badge && (
            <Badge variant="outline" className="rounded-full bg-white/80 text-[10px] uppercase tracking-[0.18em]">
              {badge}
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();

  const { data: activityLog = [], isLoading: loadingActivity } = useQuery({
    queryKey: ["workspace-activity", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchWorkspaceActivity(workspaceId!),
    refetchInterval: 30_000,
  });

  const { data: notifications = [], isLoading: loadingNotifications } = useQuery({
    queryKey: ["workspace-notifications", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchWorkspaceNotifications(workspaceId!),
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: () => markWorkspaceNotificationsRead(workspaceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-notifications", workspaceId] });
    },
  });

  const isLoading = loadingActivity || loadingNotifications;
  const unreadCount = notifications.filter((n) => !n.read).length;
  const criticalAlerts = notifications.filter((n) => n.severity === "high").length;

  return (
    <div className="page-container animate-fade-in space-y-8">
      <section className="hero-panel overflow-hidden p-6 lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Badge className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10">
              <Radio className="mr-1 h-3.5 w-3.5" />
              Workspace pulse
            </Badge>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 lg:text-4xl">
              One feed for system motion, alerts, and agent output
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Follow what changed, what needs attention, and what the agent system decided without bouncing across pages.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                className="rounded-xl bg-white/70"
                onClick={() => markReadMutation.mutate()}
                disabled={markReadMutation.isPending}
              >
                Mark all read
              </Button>
            )}
          </div>
        </div>
      </section>

      {isLoading && <p className="text-sm text-muted-foreground">Loading activity...</p>}

      {!isLoading && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Activity events", value: activityLog.length, tone: "text-primary" },
              { label: "Unread alerts", value: unreadCount, tone: "text-amber-700" },
              { label: "Critical signals", value: criticalAlerts, tone: "text-rose-700" },
            ].map((item) => (
              <div key={item.label} className="card-base">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {item.label}
                </p>
                <p className={`mt-3 text-2xl font-extrabold tracking-tight ${item.tone}`}>
                  {item.value}
                </p>
              </div>
            ))}
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="rounded-[28px] border-white/60 bg-white/90 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.28)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Activity className="h-4 w-4 text-primary" />
                  Activity timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activityLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No activity yet. Finalize a PRD, add teammates, or let the agents run to see events appear here.
                  </p>
                ) : (
                  (activityLog as ActivityLogEntry[]).map((entry, index) => {
                    const Icon = iconForAction(entry.action_type);
                    return (
                      <TimelineItem
                        key={`${entry.timestamp}-${index}`}
                        icon={Icon}
                        title={entry.description}
                        badge={entry.action_type.replace(/_/g, " ")}
                        meta={formatTimestamp(entry.timestamp)}
                      />
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[28px] border-white/60 bg-white/90 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.28)]">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Bell className="h-4 w-4 text-primary" />
                  Notifications
                </CardTitle>
                {unreadCount > 0 && (
                  <Badge className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10">
                    {unreadCount} unread
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {notifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notifications yet.</p>
                ) : (
                  (notifications as WorkspaceNotification[]).map((notification, index) => {
                    const Icon = iconForNotificationType(notification.type);
                    const tone = colorForSeverity(notification.severity);
                    return (
                      <div
                        key={`${notification.type}-${notification.created_at}-${index}`}
                        className={`rounded-2xl border p-4 ${tone} ${!notification.read ? "shadow-sm" : "opacity-90"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-2xl bg-white/70 p-2">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className={`text-sm ${!notification.read ? "font-semibold" : "font-medium"}`}>
                                {notification.message ?? "Notification"}
                              </p>
                              {notification.type && (
                                <Badge variant="outline" className="rounded-full bg-white/70 text-[10px] uppercase tracking-[0.18em]">
                                  {notification.type}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-xs opacity-80">
                              {notification.created_at
                                ? formatTimestamp(notification.created_at)
                                : "Recently added"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
