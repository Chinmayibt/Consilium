import { api } from "./client";

export type WorkspaceStatus = "active" | "completed";

export interface WorkspaceMember {
  user_id: string;
  name?: string | null;
  email?: string | null;
  role: "manager" | "member";
  skills?: string[];
  joined_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string | null;
  invite_code?: string | null;
  tech_stack?: string | null;
  team_size?: number | null;
  deadline?: string | null;
  owner_id: string;
  members: WorkspaceMember[];
  created_at: string;
  status: WorkspaceStatus;
}

export interface Prd {
  overview: string;
  problem_statement: string;
  target_users: string[];
  market_analysis: string[];
  features: string[];
  user_stories: string[];
  functional_requirements: string[];
  non_functional_requirements: string[];
  tech_stack: string[];
  system_architecture: string[];
  database_design: string[];
  api_design: string[];
  security: string[];
  performance: string[];
  deployment: string[];
  folder_structure: string[];
  milestones: string[];
  mvp_scope: string[];
  future_enhancements: string[];
  // allow extra keys from the agent if needed
  [key: string]: any;
}

export interface CreateWorkspacePayload {
  name: string;
  description?: string;
  tech_stack?: string;
  team_size?: number;
  deadline?: string;
  invite_code?: string;
}

export interface JoinWorkspacePayload {
  invite_code: string;
}

export interface GeneratePrdPayload {
  product_name: string;
  product_description: string;
  target_users: string;
  key_features: string;
  competitors?: string;
  constraints?: string;
}

export interface RoadmapPhase {
  phase: string;
  title: string;
  date_range?: string;
  items: string[];
}

export interface RoadmapTask {
  id?: string;
  title: string;
  description?: string;
  phase?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  assigned_to_role?: string;
  assigned_user_id?: string;
  assigned_name?: string;
  status?: string;
  priority?: string;
  deadline?: string;
  dependencies?: string[];
  [key: string]: unknown;
}

export interface Roadmap {
  phases: RoadmapPhase[];
  tasks: RoadmapTask[];
  [key: string]: any;
}

export async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data } = await api.get<Workspace[]>("/workspaces");
  return data;
}

export async function createWorkspace(payload: CreateWorkspacePayload): Promise<Workspace> {
  const { data } = await api.post<Workspace>("/workspaces", payload);
  return data;
}

export async function joinWorkspace(payload: JoinWorkspacePayload): Promise<Workspace> {
  const { data } = await api.post<Workspace>("/workspaces/join", payload);
  return data;
}

export async function generateWorkspacePrd(
  workspaceId: string,
  payload: GeneratePrdPayload,
): Promise<Prd> {
  const { data } = await api.post<{ prd: Prd }>(
    `/api/workspaces/${workspaceId}/generate-prd`,
    payload,
  );
  return data.prd;
}

export async function saveWorkspacePrd(
  workspaceId: string,
  prd: Prd,
): Promise<void> {
  await api.put(`/api/workspaces/${workspaceId}/prd`, { prd });
}

export async function fetchWorkspacePrd(
  workspaceId: string,
): Promise<{ prd: Prd | null; status: string }> {
  const { data } = await api.get<{ prd: Prd | null; prd_status: string }>(
    `/api/workspaces/${workspaceId}/prd`,
  );
  return { prd: data.prd ?? null, status: data.prd_status ?? "draft" };
}

export async function finalizeWorkspacePrd(
  workspaceId: string,
): Promise<void> {
  await api.post(`/api/workspaces/${workspaceId}/finalize-prd`);
}

export async function downloadWorkspacePrdMarkdown(
  workspaceId: string,
): Promise<Blob> {
  const response = await api.get(
    `/api/workspaces/${workspaceId}/prd/markdown`,
    { responseType: "blob" },
  );
  return response.data;
}

export async function downloadWorkspacePrdPdf(
  workspaceId: string,
): Promise<Blob> {
  const response = await api.get(`/api/workspaces/${workspaceId}/prd/pdf`, {
    responseType: "blob",
  });
  return response.data;
}

export async function fetchWorkspaceRoadmap(
  workspaceId: string,
): Promise<Roadmap | null> {
  const { data } = await api.get<{
    roadmap: { phases: RoadmapPhase[]; tasks?: RoadmapTask[] } | null;
  }>(`/api/workspaces/${workspaceId}/roadmap`);
  if (!data.roadmap) return null;
  return {
    phases: data.roadmap.phases ?? [],
    tasks: data.roadmap.tasks ?? [],
  };
}

export interface KanbanColumn {
  backlog: RoadmapTask[];
  todo: RoadmapTask[];
  in_progress: RoadmapTask[];
  review: RoadmapTask[];
  blocked: RoadmapTask[];
  done: RoadmapTask[];
}

const emptyKanban = (): KanbanColumn => ({
  backlog: [],
  todo: [],
  in_progress: [],
  review: [],
  blocked: [],
  done: [],
});

export async function fetchWorkspaceKanban(
  workspaceId: string,
): Promise<{ kanban: KanbanColumn; tasks: RoadmapTask[] }> {
  const { data } = await api.get<{ kanban: KanbanColumn; tasks: RoadmapTask[] }>(
    `/api/workspaces/${workspaceId}/kanban`,
  );
  return {
    kanban: data.kanban ?? emptyKanban(),
    tasks: data.tasks ?? [],
  };
}

export interface UpdateWorkspaceTaskPayload {
  status?: string;
  priority?: string;
  deadline?: string;
}

export async function updateWorkspaceTaskStatus(
  workspaceId: string,
  taskId: string,
  payload: UpdateWorkspaceTaskPayload,
): Promise<{ task: RoadmapTask }> {
  const { data } = await api.patch<{ task: RoadmapTask }>(
    `/api/workspaces/${workspaceId}/tasks/${taskId}`,
    payload,
  );
  return data;
}

export interface WorkspaceNotification {
  id?: string;
  user_id?: string | null;
  type?: string;
  message?: string;
  severity?: string;
  read?: boolean;
  created_at?: string;
  workspace_id?: string;
  workspace_name?: string;
}

export async function fetchWorkspaceNotifications(
  workspaceId: string,
): Promise<WorkspaceNotification[]> {
  const { data } = await api.get<{ notifications: WorkspaceNotification[] }>(
    `/api/workspaces/${workspaceId}/notifications`,
  );
  return data.notifications ?? [];
}

export async function markWorkspaceNotificationsRead(
  workspaceId: string,
  notificationIds?: string[],
): Promise<void> {
  await api.patch(`/api/workspaces/${workspaceId}/notifications/read`, {
    notification_ids: notificationIds ?? null,
  });
}

export async function fetchNotifications(): Promise<{
  notifications: WorkspaceNotification[];
  unread_count: number;
}> {
  const { data } = await api.get<{
    notifications: WorkspaceNotification[];
    unread_count: number;
  }>("/api/notifications");
  return {
    notifications: data.notifications ?? [],
    unread_count: data.unread_count ?? 0,
  };
}

export async function markNotificationsRead(): Promise<void> {
  await api.post("/api/notifications/read");
}

export interface ActivityLogEntry {
  action_type: string;
  description: string;
  user_id: string;
  entity_id: string;
  timestamp: string;
}

export async function fetchWorkspaceActivity(
  workspaceId: string,
): Promise<ActivityLogEntry[]> {
  const { data } = await api.get<{ activity_log: ActivityLogEntry[] }>(
    `/api/workspaces/${workspaceId}/activity`,
  );
  return data.activity_log ?? [];
}

export interface WorkspaceRisk {
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  suggested_action: string;
  created_at: string;
}

export async function fetchWorkspaceRisks(
  workspaceId: string,
): Promise<WorkspaceRisk[]> {
  const { data } = await api.get<{ risks: WorkspaceRisk[] }>(
    `/api/workspaces/${workspaceId}/risks`,
  );
  return data.risks ?? [];
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await api.delete(`/workspaces/${workspaceId}`);
}

export async function removeWorkspaceMember(
  workspaceId: string,
  memberId: string,
): Promise<void> {
  await api.delete(`/workspaces/${workspaceId}/members/${memberId}`);
}

export interface ProjectInsightsRequest {
  workspaceId: string;
  question: string;
}

export interface ProjectInsightsResponse {
  answer: string;
}

export async function fetchProjectInsight(
  payload: ProjectInsightsRequest,
): Promise<ProjectInsightsResponse> {
  const { data } = await api.post<ProjectInsightsResponse>(
    "/api/ai/project-insights",
    payload,
  );
  return data;
}
