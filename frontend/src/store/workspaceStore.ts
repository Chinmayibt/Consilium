import { create } from "zustand";
import type { Workspace } from "@/api/workspaces";

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setWorkspaces: (items: Workspace[]) => void;
  setActiveWorkspace: (ws: Workspace) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspace: null,
  setWorkspaces: (items) => set({ workspaces: items }),
  setActiveWorkspace: (ws) => set({ activeWorkspace: ws }),
}));

