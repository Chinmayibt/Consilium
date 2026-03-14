import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, GitBranch } from "lucide-react";
import {
  fetchWorkspaceKanban,
  type RoadmapTask,
  type KanbanColumn,
} from "@/api/workspaces";

const columnConfig: { key: keyof KanbanColumn; label: string; color: string }[] = [
  { key: "todo", label: "To Do", color: "bg-muted-foreground/30" },
  { key: "in_progress", label: "In Progress", color: "bg-primary" },
  { key: "blocked", label: "Blocked", color: "bg-destructive" },
  { key: "done", label: "Done", color: "bg-success" },
];

function initials(name: string | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function KanbanPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["workspace-kanban", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchWorkspaceKanban(workspaceId!),
  });

  const kanban = data?.kanban ?? { todo: [], in_progress: [], blocked: [], done: [] };

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1>Kanban Board</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Tasks from Planning Agent · updated by Monitoring Agent
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          Live data
        </Badge>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading Kanban...</p>
      )}

      {!isLoading && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columnConfig.map(({ key, label, color }) => {
            const tasks = (kanban[key] ?? []) as RoadmapTask[];
            return (
              <div key={key} className="flex-shrink-0 w-72">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`h-2 w-2 rounded-full ${color}`} />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="caption">{tasks.length}</span>
                </div>
                <div className="space-y-2">
                  {tasks.map((task, i) => (
                    <div
                      key={(task as any).id ?? `${key}-${i}`}
                      className="card-base space-y-3"
                    >
                      <p className="text-sm font-medium leading-snug">{task.title}</p>
                      {(task as any).github_pr != null && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <GitBranch className="h-3 w-3" />
                          <span className="text-[11px] font-mono">PR #{(task as any).github_pr}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[9px] bg-muted">
                              {initials(task.assigned_to_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            {task.assigned_to_name ?? "Unassigned"}
                          </span>
                        </div>
                        {(task as any).deadline && (
                          <span className="caption flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {(task as any).deadline}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && data && !data.tasks?.length && (
        <p className="text-sm text-muted-foreground">
          No tasks yet. Finalize a PRD to generate tasks and populate the board.
        </p>
      )}
    </div>
  );
}
