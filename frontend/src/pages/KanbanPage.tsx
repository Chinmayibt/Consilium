import { useCallback, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, GitBranch, Flag, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  fetchWorkspaceKanban,
  updateWorkspaceTaskStatus,
  createWorkspaceTask,
  type RoadmapTask,
  type KanbanColumn,
} from "@/api/workspaces";

function taskRowId(task: RoadmapTask): string {
  return String(task.id ?? task.title ?? "");
}

const COLUMN_IDS = ["todo", "in_progress", "review", "blocked", "done"] as const;
type ColumnId = (typeof COLUMN_IDS)[number];

const columnConfig: { id: ColumnId; label: string; color: string }[] = [
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
  onEdit,
}: {
  task: RoadmapTask;
  isOverlay?: boolean;
  onEdit?: (task: RoadmapTask) => void;
}) {
  const assignedName = task.assigned_name ?? task.assigned_to_name ?? "Unassigned";
  const priority = task.priority ?? "medium";

  return (
    <div
      className={`rounded-xl border border-border/60 bg-card p-4 shadow-sm space-y-3 ${
        isOverlay ? "shadow-lg ring-2 ring-primary/30 rotate-2 scale-[1.02]" : "hover:shadow-md hover:border-primary/30 transition-all"
      }`}
    >
      <div className="flex items-start gap-2">
        <p className="text-sm font-semibold leading-snug flex-1 min-w-0">{task.title}</p>
        {onEdit && !isOverlay && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            aria-label="Edit task"
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </div>
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
  onEditTask,
}: {
  id: ColumnId;
  label: string;
  color: string;
  tasks: RoadmapTask[];
  taskCount: number;
  onEditTask?: (task: RoadmapTask) => void;
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
          <DraggableTask key={taskRowId(task)} task={task} onEdit={onEditTask} />
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

function DraggableTask({
  task,
  onEdit,
}: {
  task: RoadmapTask;
  onEdit?: (task: RoadmapTask) => void;
}) {
  const id = taskRowId(task);
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
      <KanbanCard task={task} onEdit={onEdit} />
    </div>
  );
}

export default function KanbanPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();
  const [activeTask, setActiveTask] = useState<RoadmapTask | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addStatus, setAddStatus] = useState<ColumnId>("todo");
  const [addPriority, setAddPriority] = useState("medium");
  const [editOpen, setEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<RoadmapTask | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<ColumnId>("todo");

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-kanban", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchWorkspaceKanban(workspaceId!),
  });

  const kanbanQueryKey = ["workspace-kanban", workspaceId] as const;

  const extractApiDetail = (err: unknown): string => {
    const ax = err as { response?: { data?: { detail?: unknown } } };
    const d = ax.response?.data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((x) => JSON.stringify(x)).join("; ");
    return "Request failed";
  };

  const updateStatusMutation = useMutation({
    mutationFn: ({
      taskId,
      status,
    }: {
      taskId: string;
      status: string;
    }) => updateWorkspaceTaskStatus(workspaceId!, taskId, { status }),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: kanbanQueryKey });
      const prev = queryClient.getQueryData<{ kanban: KanbanColumn; tasks: RoadmapTask[] }>(kanbanQueryKey);
      if (!prev) return { prev };
      const kanban = { ...prev.kanban } as KanbanColumn;
      let moved: RoadmapTask | null = null;
      for (const key of COLUMN_IDS) {
        const list = kanban[key] ?? [];
        const idx = list.findIndex((t) => taskRowId(t) === taskId);
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
        queryClient.setQueryData(kanbanQueryKey, {
          ...prev,
          kanban,
        });
      }
      return { prev };
    },
    onError: (err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(kanbanQueryKey, context.prev);
      }
      toast.error(extractApiDetail(err));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: kanbanQueryKey });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: () =>
      createWorkspaceTask(workspaceId!, {
        title: addTitle.trim(),
        description: addDescription.trim() || undefined,
        status: addStatus,
        priority: addPriority,
      }),
    onSuccess: () => {
      toast.success("Task added");
      setAddOpen(false);
      setAddTitle("");
      setAddDescription("");
      setAddStatus("todo");
      setAddPriority("medium");
    },
    onError: (err) => toast.error(extractApiDetail(err)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: kanbanQueryKey }),
  });

  const saveEditMutation = useMutation({
    mutationFn: () => {
      if (!editingTask || !workspaceId) throw new Error("No task");
      return updateWorkspaceTaskStatus(workspaceId, taskRowId(editingTask), {
        title: editTitle.trim(),
        description: editDescription,
        status: editStatus,
      });
    },
    onSuccess: () => {
      toast.success("Task updated");
      setEditOpen(false);
      setEditingTask(null);
    },
    onError: (err) => toast.error(extractApiDetail(err)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: kanbanQueryKey }),
  });

  const openEdit = useCallback((task: RoadmapTask) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditDescription(String(task.description ?? ""));
    const st = (task.status || "todo").toLowerCase();
    setEditStatus((COLUMN_IDS.includes(st as ColumnId) ? st : "todo") as ColumnId);
    setEditOpen(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const kanban = useMemo(() => {
    const k = data?.kanban ?? {};
    return {
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
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1>Kanban Board</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drag cards between columns, or use Add / Edit to manage tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add task
          </Button>
          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
            Live Sync
          </Badge>
        </div>
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
                onEditTask={openEdit}
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
          No tasks yet. Use <strong>Add task</strong> above or finalize a PRD to generate tasks.
        </p>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Add a task to this workspace. It will appear in the column you choose.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-title">Title</Label>
              <Input
                id="add-title"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder="Short task title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-desc">Description (optional)</Label>
              <Textarea
                id="add-desc"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                placeholder="Details, acceptance criteria…"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Column</Label>
                <Select value={addStatus} onValueChange={(v) => setAddStatus(v as ColumnId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {columnConfig.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={addPriority} onValueChange={setAddPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!addTitle.trim() || createTaskMutation.isPending}
              onClick={() => createTaskMutation.mutate()}
            >
              {createTaskMutation.isPending ? "Saving…" : "Create task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingTask(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
            <DialogDescription>Update title, description, or column. Changes save to the workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input id="edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Column</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v as ColumnId)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columnConfig.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!editTitle.trim() || saveEditMutation.isPending}
              onClick={() => saveEditMutation.mutate()}
            >
              {saveEditMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
