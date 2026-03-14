import { api } from "./client";

export type WorkspaceStatus = "active" | "completed";

export interface WorkspaceMember {
  user_id: string;
  name?: string | null;
  email?: string | null;
  role: "manager" | "member";
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
  title: string;
  description?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  status?: string;
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
  todo: RoadmapTask[];
  in_progress: RoadmapTask[];
  blocked: RoadmapTask[];
  done: RoadmapTask[];
}

export async function fetchWorkspaceKanban(
  workspaceId: string,
): Promise<{ kanban: KanbanColumn; tasks: RoadmapTask[] }> {
  const { data } = await api.get<{ kanban: KanbanColumn; tasks: RoadmapTask[] }>(
    `/api/workspaces/${workspaceId}/kanban`,
  );
  return { kanban: data.kanban ?? { todo: [], in_progress: [], blocked: [], done: [] }, tasks: data.tasks ?? [] };
}

export interface WorkspaceNotification {
  type?: string;
  message?: string;
  severity?: string;
}

export async function fetchWorkspaceNotifications(
  workspaceId: string,
): Promise<WorkspaceNotification[]> {
  const { data } = await api.get<{ notifications: WorkspaceNotification[] }>(
    `/api/workspaces/${workspaceId}/notifications`,
  );
  return data.notifications ?? [];
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

