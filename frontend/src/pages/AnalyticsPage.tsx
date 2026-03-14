import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { fetchWorkspaceKanban } from "@/api/workspaces";

const completionColors = [
  { name: "Done", color: "hsl(142, 64%, 40%)" },
  { name: "In Progress", color: "hsl(220, 72%, 50%)" },
  { name: "Blocked", color: "hsl(0, 72%, 51%)" },
  { name: "To Do", color: "hsl(220, 14%, 70%)" },
];

export default function AnalyticsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["workspace-kanban", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchWorkspaceKanban(workspaceId!),
  });

  const tasks = data?.tasks ?? [];
  const kanban = data?.kanban ?? { todo: [], in_progress: [], blocked: [], done: [] };
  const todo = kanban.todo?.length ?? 0;
  const inProgress = kanban.in_progress?.length ?? 0;
  const blocked = kanban.blocked?.length ?? 0;
  const done = kanban.done?.length ?? 0;

  const completionData = [
    { name: "Done", value: done, color: completionColors[0].color },
    { name: "In Progress", value: inProgress, color: completionColors[1].color },
    { name: "Blocked", value: blocked, color: completionColors[2].color },
    { name: "To Do", value: todo, color: completionColors[3].color },
  ].filter((d) => d.value > 0);

  const byAssignee: Record<string, number> = {};
  for (const t of tasks) {
    const name = (t as any).assigned_to_name ?? "Unassigned";
    byAssignee[name] = (byAssignee[name] ?? 0) + 1;
  }
  const productivityData = Object.entries(byAssignee).map(([name, count]) => ({
    name,
    tasks: count,
  }));

  return (
    <div className="page-container animate-fade-in">
      <div>
        <h1>Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Project metrics from workspace tasks
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading analytics...</p>
      )}

      {!isLoading && tasks.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No task data yet. Finalize a PRD to generate tasks and see analytics here.
        </p>
      )}

      {!isLoading && tasks.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card-base space-y-4">
            <h3>Task Completion</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={completionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={4}
                >
                  {completionData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 flex-wrap">
              {completionData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {d.name} ({d.value})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-base space-y-4">
            <h3>Team Productivity</h3>
            {productivityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={productivityData} layout="vertical" margin={{ left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 90%)" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="tasks"
                    fill="hsl(142, 64%, 40%)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No assignees yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
