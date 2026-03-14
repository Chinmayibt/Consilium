import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Building2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/store/authStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import {
  Workspace,
  fetchWorkspaces,
  createWorkspace,
  joinWorkspace,
} from "@/api/workspaces";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

function WorkspaceCard({ workspace }: { workspace: Workspace }) {
  const navigate = useNavigate();
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const isOwner = user && workspace.owner_id === user.id;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Are you sure you want to delete workspace "${workspace.name}"?`,
      )
    ) {
      return;
    }
    try {
      const { deleteWorkspace } = await import("@/api/workspaces");
      await deleteWorkspace(workspace.id);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setActiveWorkspace(null as any);
      toast.success("Workspace deleted");
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        "Unable to delete workspace.";
      toast.error(msg);
    }
  };

  const memberCount = workspace.members.length;

  const handleOpen = () => {
    setActiveWorkspace(workspace);
    navigate(`/dashboard/${workspace.id}/requirements`);
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="group flex flex-col items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-semibold">
            {workspace.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-foreground line-clamp-1">
              {workspace.name}
            </h3>
            {workspace.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {workspace.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={workspace.status === "completed" ? "outline" : "secondary"}
            className="text-[11px] uppercase tracking-wide"
          >
            {workspace.status === "completed" ? "Completed" : "Active"}
          </Badge>
          {isOwner && (
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between w-full text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          <span>{memberCount} members</span>
        </div>
        {workspace.tech_stack && (
          <span className="truncate max-w-[140px]">{workspace.tech_stack}</span>
        )}
      </div>
    </button>
  );
}

export default function WorkspacesPage() {
  const user = useAuthStore((s) => s.user);
  const isManager = user?.role === "manager";
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: fetchWorkspaces,
  });

  useEffect(() => {
    if (data) {
      setWorkspaces(data);
    }
  }, [data, setWorkspaces]);

  const createMutation = useMutation({
    mutationFn: createWorkspace,
    onSuccess: async (workspace: Workspace) => {
      setActiveWorkspace(workspace);
      toast.success("Workspace created");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setCreateOpen(false);
      navigate(`/dashboard/${workspace.id}/requirements`);

      if (workspace.invite_code) {
        try {
          await navigator.clipboard.writeText(workspace.invite_code);
          toast.success(`Invite code copied: ${workspace.invite_code}`);
        } catch {
          toast.message("Invite code", {
            description: workspace.invite_code,
          });
        }
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? "Unable to create workspace.";
      toast.error(msg);
    },
  });

  const joinMutation = useMutation({
    mutationFn: joinWorkspace,
    onSuccess: () => {
      toast.success("Joined workspace");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setJoinOpen(false);
      setInviteCode("");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.detail ?? "Unable to join workspace.";
      toast.error(msg);
    },
  });

  const handleCreate = (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      tech_stack: String(formData.get("tech_stack") || ""),
      team_size: formData.get("team_size")
        ? Number(formData.get("team_size"))
        : undefined,
      deadline: formData.get("deadline")
        ? String(formData.get("deadline"))
        : undefined,
    };
    createMutation.mutate(payload);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    joinMutation.mutate({ invite_code: inviteCode.trim() });
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Your workspaces
          </h1>
          <p className="text-sm text-muted-foreground">
            Select a workspace to open its AI-powered project dashboard.
          </p>
        </div>
        <div className="flex gap-2">
          {isManager && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="h-9 rounded-lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Create workspace
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create new workspace</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4 mt-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleCreate(e.currentTarget);
                  }}
                >
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium">Name</label>
                    <Input
                      name="name"
                      placeholder="Project Phoenix"
                      required
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium">Description</label>
                    <Textarea
                      name="description"
                      placeholder="Brief description of this project..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[13px] font-medium">
                        Tech Stack
                      </label>
                      <Input
                        name="tech_stack"
                        placeholder="React, FastAPI, MongoDB"
                        className="h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[13px] font-medium">
                        Team Size
                      </label>
                      <Input
                        name="team_size"
                        type="number"
                        min={1}
                        className="h-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-medium">Deadline</label>
                    <Input name="deadline" type="date" className="h-10" />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-10 rounded-lg"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Creating..." : "Create workspace"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-9 rounded-lg">
                <Building2 className="mr-2 h-4 w-4" />
                Join with code
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Join workspace</DialogTitle>
              </DialogHeader>
              <form className="space-y-4 mt-2" onSubmit={handleJoin}>
                <div className="space-y-2">
                  <label className="text-[13px] font-medium">Invite code</label>
                  <Input
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="PROJ-XXXX-XXXX"
                    className="h-10 font-mono"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-10 rounded-lg"
                  disabled={joinMutation.isPending}
                >
                  {joinMutation.isPending ? "Joining..." : "Join workspace"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading workspaces...</p>
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((ws) => (
            <WorkspaceCard key={ws.id} workspace={ws} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border border-dashed rounded-xl">
          <p className="text-sm text-muted-foreground max-w-md">
            {isManager
              ? "You don't have any workspaces yet. Create one to get started with AI-powered project management."
              : "You haven't joined any workspaces yet. Ask your manager for an invite code to join."}
          </p>
        </div>
      )}
    </div>
  );
}

