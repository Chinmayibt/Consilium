import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { MessageSquare, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fetchWorkspaceNotifications } from "@/api/workspaces";

function iconForType(type: string | undefined) {
  switch (type) {
    case "risk":
    case "blocker":
      return AlertTriangle;
    case "project_completed":
      return CheckCircle2;
    default:
      return MessageSquare;
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

export default function ActivityPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["workspace-notifications", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchWorkspaceNotifications(workspaceId!),
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1>Activity Feed</h1>
          <p className="text-sm text-muted-foreground mt-1">
            In-app notifications from agents and system events
          </p>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading activity...</p>
      )}

      {!isLoading && (
        <div className="max-w-2xl space-y-0">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No notifications yet. Complete a PRD and run the orchestrator to see agent updates here.
            </p>
          ) : (
            notifications.map((n, i) => {
              const Icon = iconForType(n.type);
              const color = colorForSeverity(n.severity);
              return (
                <div key={i} className="relative flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-card border ${color}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {i < notifications.length - 1 && (
                      <div className="w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className="pb-6 flex-1">
                    <p className="text-sm">{n.message ?? "Notification"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        {n.type ?? "system"}
                      </Badge>
                      {n.severity && (
                        <Badge variant="secondary" className="text-[9px]">
                          {n.severity}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
