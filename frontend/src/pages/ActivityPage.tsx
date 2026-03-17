import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { MessageSquare, AlertTriangle, CheckCircle2, Activity, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      return "text-destructive";
    case "medium":
      return "text-warning";
    default:
      return "text-primary";
  }
}

function formatTimestamp(ts: string) {
  try {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60_000) return "Just now";
    if (diffMs < 3600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    if (diffMs < 86400_000) return `${Math.floor(diffMs / 3600_000)}h ago`;
    return d.toLocaleDateString();
  } catch {
    return ts;
  }
}

export default function ActivityPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();

  const { data: activityLog = [], isLoading: loadingActivity } = useQuery({
    queryKey: ["workspace-activity", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchWorkspaceActivity(workspaceId!),
  });

  const { data: notifications = [], isLoading: loadingNotifications } = useQuery({
    queryKey: ["workspace-notifications", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchWorkspaceNotifications(workspaceId!),
  });

  const markReadMutation = useMutation({
    mutationFn: () => markWorkspaceNotificationsRead(workspaceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-notifications", workspaceId] });
    },
  });

  const isLoading = loadingActivity || loadingNotifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1>Activity Feed</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Actions and notifications from the workspace
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markReadMutation.mutate()}
            disabled={markReadMutation.isPending}
          >
            Mark all read
          </Button>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading activity...</p>
      )}

      {!isLoading && (
        <div className="max-w-2xl space-y-8">
          {/* Activity log */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activity
            </h2>
            {activityLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No activity yet. Finalize a PRD, add members, or let the orchestrator run to see events here.
              </p>
            ) : (
              <div className="space-y-0">
                {(activityLog as ActivityLogEntry[]).map((entry, i) => {
                  const Icon = iconForAction(entry.action_type);
                  return (
                    <div key={`${entry.timestamp}-${i}`} className="relative flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card border text-primary">
                          <Icon className="h-4 w-4" />
                        </div>
                        {i < activityLog.length - 1 && (
                          <div className="w-px flex-1 bg-border min-h-[8px]" />
                        )}
                      </div>
                      <div className="pb-6 flex-1">
                        <p className="text-sm">{entry.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            {entry.action_type.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Notifications */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {unreadCount}
                </Badge>
              )}
            </h2>
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              <div className="space-y-0">
                {(notifications as WorkspaceNotification[]).map((n, i) => {
                  const Icon = iconForNotificationType(n.type);
                  const color = colorForSeverity(n.severity);
                  return (
                    <div key={i} className="relative flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card border ${color} ${!n.read ? "ring-2 ring-primary/30" : ""}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        {i < notifications.length - 1 && (
                          <div className="w-px flex-1 bg-border min-h-[8px]" />
                        )}
                      </div>
                      <div className="pb-6 flex-1">
                        <p className={`text-sm ${!n.read ? "font-medium" : ""}`}>
                          {n.message ?? "Notification"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            {n.type ?? "system"}
                          </Badge>
                          {n.severity && (
                            <Badge variant="secondary" className="text-[9px]">
                              {n.severity}
                            </Badge>
                          )}
                          {n.created_at && (
                            <span className="text-[11px] text-muted-foreground">
                              {formatTimestamp(n.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
