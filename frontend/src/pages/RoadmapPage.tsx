import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Circle } from "lucide-react";
import {
  fetchWorkspaceRoadmap,
  type Roadmap,
} from "@/api/workspaces";

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    className: "bg-success/10 text-success border-success/20",
  },
  "in-progress": {
    icon: Clock,
    label: "In Progress",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  upcoming: {
    icon: Circle,
    label: "Upcoming",
    className: "bg-muted text-muted-foreground border-border",
  },
} as const;

function inferPhaseStatus(index: number, total: number) {
  if (index === 0) return "in-progress";
  if (index < total - 1) return "upcoming";
  return "upcoming";
}

export default function RoadmapPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const { data, isLoading } = useQuery<Roadmap | null>({
    queryKey: ["workspace-roadmap", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return null;
      return await fetchWorkspaceRoadmap(workspaceId);
    },
  });

  const phases = data?.phases ?? [];
  const tasks = data?.tasks ?? [];

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1>Roadmap</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Project timeline generated automatically from your PRD.
          </p>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading roadmap...</p>
      )}

      {!isLoading && !data && (
        <p className="text-sm text-muted-foreground">
          No roadmap found yet. Generate a PRD first to create a roadmap.
        </p>
      )}

      {!isLoading && data && (
        <div className="grid gap-8 lg:grid-cols-[2fr,1fr]">
          <div className="max-w-3xl space-y-0">
            {phases.map((p, i) => {
              const status = inferPhaseStatus(i, phases.length);
              const config = statusConfig[status];
              const StatusIcon = config.icon;
              return (
                <div key={p.phase ?? i} className="relative flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${config.className}`}
                    >
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    {i < phases.length - 1 && (
                      <div className="w-px flex-1 bg-border" />
                    )}
                  </div>

                  <div className="card-base flex-1 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="caption">
                          {p.phase}
                        </span>
                        <h3 className="mt-0.5">{p.title}</h3>
                      </div>
                      {p.date_range && (
                        <Badge
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {p.date_range}
                        </Badge>
                      )}
                    </div>
                    {p.items && p.items.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {p.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                            {item}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-base font-semibold">
                Tasks & Assignments
              </h2>
              {tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No tasks generated yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <div
                      key={t.id}
                      className="card-base px-3 py-2 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{t.title}</p>
                        {t.description && (
                          <p className="text-xs text-muted-foreground">
                            {t.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Assigned to:{" "}
                          <span className="font-medium">
                            {t.assigned_to_name ?? t.assigned_to ?? "Unassigned"}
                          </span>
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase"
                      >
                        {t.status ?? "todo"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
