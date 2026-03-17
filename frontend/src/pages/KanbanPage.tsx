import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Clock, GitBranch, Flag } from "lucide-react";
import {
  fetchWorkspaceKanban,
  updateWorkspaceTaskStatus,
  type RoadmapTask,
  type KanbanColumn,
} from "@/api/workspaces";

const COLUMN_IDS = ["backlog", "todo", "in_progress", "review", "blocked", "done"] as const;
type ColumnId = (typeof COLUMN_IDS)[number];

const columnConfig: { id: ColumnId; label: string; color: string }[] = [
  { id: "backlog", label: "Backlog", color: "bg-muted-foreground/30" },
  { id: "todo", label: "To Do", color: "bg-slate-500" },
  { id: "in_progress", label: "In Progress", color: "bg-primary" },
  { id: "review", label: "Review", color: "bg-amber-500" },
  { id: "blocked", label: "Blocked", color: "bg-destructive" },
  { id: "done", label: "Done", color: "bg-emerald-500" },
];

function initials(name: string | undefined): string {
  if (!name) return "?";
  const n = (name || "").trim();
  if (!n) return "?";
  const parts = n.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase();
}

function priorityColor(priority: string | undefined): string {
  switch ((priority || "").toLowerCase()) {
    case "high":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "medium":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "low":
      return "bg-muted text-muted-foreground border-border";
    default:
      return "bg-muted/80 text-muted-foreground border-border";
  }
}

function KanbanCard({
  task,
  isOverlay = false,
}: {
  task: RoadmapTask;
  isOverlay?: boolean;
}) {
  const assignedName = task.assigned_name ?? task.assigned_to_name ?? "Unassigned";
  const priority = task.priority ?? "medium";

  return (
    <div
      className={`rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-3 ${
        isOverlay ? "shadow-lg ring-2 ring-primary/30 rotate-2 scale-[1.02]" : "hover:shadow-md hover:border-primary/30 transition-all"
      }`}
    >
      <p className="text-sm font-semibold leading-snug">{task.title}</p>
      {(task as RoadmapTask & { github_pr?: number }).github_pr != null && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5 text-primary/70" />
          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded-md">
            PR #{(task as RoadmapTask & { github_pr: number }).github_pr}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 pt-2 border-t border-border/40">
        <Avatar className="h-6 w-6 border border-border/80">
          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
            {initials(assignedName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium text-muted-foreground block truncate">
            {assignedName}
          </span>
          {task.assigned_to_role && (
            <span className="text-[10px] text-muted-foreground/80 capitalize block">
              {task.assigned_to_role}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {(task as RoadmapTask & { phase?: string }).phase && (
          <span className="text-[10px] text-muted-foreground bg-muted/70 px-1.5 py-0.5 rounded">
            {(task as RoadmapTask & { phase: string }).phase}
          </span>
        )}
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${priorityColor(priority)}`}>
          <Flag className="h-2.5 w-2.5 mr-0.5" />
          {priority}
        </Badge>
        {task.deadline && (
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded-md">
            <Clock className="h-3 w-3" />
            {task.deadline}
          </span>
        )}
      </div>
    </div>
  );
}

function DroppableColumn({
  id,
  label,
  color,
  tasks,
  taskCount,
}: {
  id: ColumnId;
  label: string;
  color: string;
  tasks: RoadmapTask[];
  taskCount: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const column = columnConfig.find((c) => c.id === id)!;

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 rounded-2xl p-4 border-2 transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : "bg-muted/30 border-border/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className={`h-2.5 w-2.5 rounded-full ${column.color} shadow-sm`} />
        <span className="text-sm font-semibold">{label}</span>
        <span className="ml-auto bg-background px-2 py-0.5 rounded-full border border-border/60 text-xs font-medium">
          {taskCount}
        </span>
      </div>
      <div className="space-y-3 min-h-[120px]">
        {tasks.map((task) => (
          <DraggableTask key={task.id ?? task.title} task={task} />
        ))}
        {tasks.length === 0 && (
          <div className="h-24 rounded-xl border-2 border-dashed border-border/60 flex items-center justify-center">
            <span className="text-xs text-muted-foreground font-medium">Drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableTask({ task }: { task: RoadmapTask }) {
  const id = task.id ?? task.title ?? "";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { task },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={isDragging ? "opacity-50" : ""}
    >
      <KanbanCard task={task} />
    </div>
  );
}

export default function KanbanPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();
  const [activeTask, setActiveTask] = useState<RoadmapTask | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-kanban", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchWorkspaceKanban(workspaceId!),
  });

  useEffect(() => {
    if (data?.tasks?.length) {
      console.log("[Kanban] tasks from API:", data.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assigned_user_id: t.assigned_user_id ?? t.assigned_to,
        assigned_name: t.assigned_name ?? t.assigned_to_name,
      })));
    }
  }, [data?.tasks]);

  const updateStatusMutation = useMutation({
    mutationFn: ({
      taskId,
      status,
    }: {
      taskId: string;
      status: string;
    }) => updateWorkspaceTaskStatus(workspaceId!, taskId, { status }),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["workspace-kanban", workspaceId] });
      const prev = queryClient.getQueryData<{ kanban: KanbanColumn; tasks: RoadmapTask[] }>([
        "workspace-kanban",
        workspaceId,
      ]);
      if (!prev) return { prev };
      const kanban = { ...prev.kanban } as KanbanColumn;
      let moved: RoadmapTask | null = null;
      for (const key of COLUMN_IDS) {
        const list = kanban[key] ?? [];
        const idx = list.findIndex((t) => (t.id ?? t.title) === taskId);
        if (idx >= 0) {
          moved = list[idx];
          kanban[key] = [...list.slice(0, idx), ...list.slice(idx + 1)];
          break;
        }
      }
      if (moved) {
        const updated = { ...moved, status };
        const targetList = kanban[status as ColumnId] ?? [];
        kanban[status as ColumnId] = [...targetList, updated];
        queryClient.setQueryData(["workspace-kanban", workspaceId], {
          ...prev,
          kanban,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["workspace-kanban", workspaceId], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-kanban", workspaceId] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const kanban = useMemo(() => {
    const k = data?.kanban ?? {};
    return {
      backlog: (k.backlog ?? []) as RoadmapTask[],
      todo: (k.todo ?? []) as RoadmapTask[],
      in_progress: (k.in_progress ?? []) as RoadmapTask[],
      review: (k.review ?? []) as RoadmapTask[],
      blocked: (k.blocked ?? []) as RoadmapTask[],
      done: (k.done ?? []) as RoadmapTask[],
    };
  }, [data?.kanban]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = event.active.data.current?.task as RoadmapTask | undefined;
    if (task) setActiveTask(task);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTask(null);
      const { active, over } = event;
      if (!over || !workspaceId) return;
      const newStatus = String(over.id);
      if (!COLUMN_IDS.includes(newStatus as ColumnId)) return;
      const taskId = String(active.id);
      updateStatusMutation.mutate({ taskId, status: newStatus });
    },
    [workspaceId, updateStatusMutation]
  );

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Kanban Board</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag tasks between columns to update status
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
          Live Sync
        </Badge>
      </div>

      {isLoading && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-shrink-0 w-72 space-y-4">
              <div className="h-6 w-32 bg-muted rounded animate-pulse" />
              <div className="h-32 bg-muted rounded-xl animate-pulse" />
              <div className="h-32 bg-muted rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4 items-start">
            {columnConfig.map(({ id, label, color }) => (
              <DroppableColumn
                key={id}
                id={id}
                label={label}
                color={color}
                tasks={kanban[id]}
                taskCount={kanban[id].length}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? <KanbanCard task={activeTask} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {!isLoading && data && data.tasks?.length === 0 && (
        <p className="text-sm text-muted-foreground mt-8 text-center bg-muted/30 py-8 rounded-xl border border-border/50">
          No tasks yet. Finalize a PRD to generate tasks and populate the board.
        </p>
      )}
    </div>
  );
}
