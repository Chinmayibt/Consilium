import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Building2, Trash2, Folder } from "lucide-react";
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
      className="group relative flex flex-col justify-between w-full min-h-[160px] rounded-2xl border border-border/60 bg-card p-6 text-left shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] transition-all duration-300 hover:scale-[1.02] hover:border-primary/40 hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
    >
      <div className="flex w-full gap-5 h-full">
        {/* Left Section: Folder Icon */}
        <div className="flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 shrink-0 group-hover:bg-indigo-500/20 group-hover:scale-105 transition-all mt-1">
          <Folder className="h-8 w-8" />
        </div>

        {/* Right Section: Content */}
        <div className="flex flex-col flex-1 h-full min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-[20px] font-bold text-foreground line-clamp-1 tracking-tight pr-2">
              {workspace.name}
            </h3>
            
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={workspace.status === "completed" ? "outline" : "secondary"}
                className="text-[10px] uppercase tracking-wider font-semibold shadow-sm px-2 py-0.5"
              >
                {workspace.status === "completed" ? "Completed" : "Active"}
              </Badge>
              {isOwner && (
                <div
                  onClick={handleDelete}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:border-destructive/40 transition-colors z-10"
                  title="Delete Workspace"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          </div>
          
          <p className="text-[14px] text-muted-foreground line-clamp-2 leading-relaxed flex-1 w-full max-w-[90%]">
            {workspace.description || "No description provided."}
          </p>

          <div className="flex items-center justify-between w-full text-[13px] font-medium text-muted-foreground mt-4 pt-3 border-t border-border/40">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              <span>{memberCount} member{memberCount !== 1 && 's'}</span>
            </div>
            <div className="flex items-center gap-2 text-foreground/70">
              <span className="truncate max-w-[140px] tracking-tight">{workspace.created_at ? new Date(workspace.created_at).toLocaleDateString() : "Just now"}</span>
            </div>
          </div>
        </div>
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
    <div className="page-container max-w-[1400px] mx-auto animate-fade-in py-8 px-4 sm:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Your workspaces
          </h1>
          <p className="text-[15px] font-medium text-muted-foreground">
            Select a project dashboard to start orchestrating work.
          </p>
        </div>
        <div className="flex items-center gap-4">
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
        <div className="grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 pt-2">
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

