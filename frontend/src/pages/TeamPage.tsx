import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useAuthStore } from "@/store/authStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { WorkspaceMember } from "@/api/workspaces";
import { api } from "@/api/client";
import { toast } from "sonner";

export default function TeamPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const user = useAuthStore((s) => s.user);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);

  const workspace =
    activeWorkspace ?? workspaces.find((w) => w.id === workspaceId) ?? null;

  const canManage =
    !!user && user.role === "manager" && !!workspace;

  const members: WorkspaceMember[] = useMemo(
    () => workspace?.members ?? [],
    [workspace],
  );

  const handleRemove = async (member: WorkspaceMember) => {
    if (!workspaceId) return;
    if (!window.confirm(`Remove ${member.name ?? "this member"} from workspace?`)) {
      return;
    }
    try {
      await api.delete(`/workspaces/${workspaceId}/members/${member.user_id}`);
      toast.success("Member removed");
      window.location.reload();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        "Failed to remove member.";
      toast.error(msg);
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Members collaborating in this workspace.
          </p>
        </div>
      </div>

      {!workspace && (
        <p className="text-sm text-muted-foreground">
          Workspace not found. Go back to your workspace list.
        </p>
      )}

      {workspace && members.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No team members yet. Invite people to join this workspace.
        </p>
      )}

      {workspace && members.length > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <div
              key={m.user_id}
              className="card-base flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {m.name ?? "Unnamed user"}
                  </p>
                  {m.email && (
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  )}
                </div>
                <Badge
                  variant={m.role === "manager" ? "secondary" : "outline"}
                  className="text-[10px] uppercase tracking-wide"
                >
                  {m.role}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Joined: {new Date(m.joined_at).toLocaleDateString()}
              </p>
              {canManage && m.user_id !== workspace.owner_id && (
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={() => handleRemove(m)}
                  >
                    Remove member
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

