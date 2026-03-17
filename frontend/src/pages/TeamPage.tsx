import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useAuthStore } from "@/store/authStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { WorkspaceMember } from "@/api/workspaces";
import { removeWorkspaceMember, fetchWorkspaces } from "@/api/workspaces";
import { toast } from "sonner";
import { UserMinus, User } from "lucide-react";

function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function TeamPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const user = useAuthStore((s) => s.user);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const queryClient = useQueryClient();

  const workspace =
    activeWorkspace ?? workspaces.find((w) => w.id === workspaceId) ?? null;

  const isManager = !!user && user.role === "manager" && !!workspace;
  const currentUserId = user?.id ?? null;

  const members: WorkspaceMember[] = useMemo(
    () => workspace?.members ?? [],
    [workspace],
  );

  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(
    null,
  );
  const [memberDetails, setMemberDetails] = useState<WorkspaceMember | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);

  const handleRemoveClick = (member: WorkspaceMember) => {
    setMemberToRemove(member);
  };

  const handleRemoveConfirm = async () => {
    if (!workspaceId || !memberToRemove) return;
    setRemoving(true);
    try {
      await removeWorkspaceMember(workspaceId, memberToRemove.user_id);
      toast.success("Member removed from workspace");
      const updated = await fetchWorkspaces();
      setWorkspaces(updated);
      const next = updated.find((w) => w.id === workspaceId);
      if (next) setActiveWorkspace(next);
      setMemberToRemove(null);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { detail?: string } } }).response
              ?.data?.detail
          : "Failed to remove member.";
      toast.error(msg ?? "Failed to remove member.");
    } finally {
      setRemoving(false);
    }
  };

  const canRemoveMember = (m: WorkspaceMember) =>
    isManager &&
    m.user_id !== currentUserId &&
    m.user_id !== workspace?.owner_id;

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Team
          </h1>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {members.map((m) => (
            <div
              key={m.user_id}
              className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/20 flex flex-col"
            >
              <div className="flex gap-3 flex-1">
                <Avatar className="h-12 w-12 rounded-lg shrink-0">
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-sm font-medium">
                    {getInitials(m.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">
                    {m.name ?? "Unnamed user"}
                  </p>
                  <Badge
                    variant={m.role === "manager" ? "secondary" : "outline"}
                    className="text-[10px] uppercase tracking-wide mt-0.5"
                  >
                    {m.role}
                  </Badge>
                  {m.skills && m.skills.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                      {m.skills.join(", ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-border/80 space-y-1">
                {m.email && (
                  <p className="text-xs text-muted-foreground truncate">
                    {m.email}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Joined {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "—"}
                </p>
              </div>
              {isManager && (
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setMemberDetails(m)}
                  >
                    <User className="h-3.5 w-3.5 mr-1.5" />
                    View details
                  </Button>
                  {canRemoveMember(m) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleRemoveClick(m)}
                    >
                      <UserMinus className="h-3.5 w-3.5 mr-1.5" />
                      Remove
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this member from the workspace?
              They will lose access to this workspace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRemoveConfirm();
              }}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!memberDetails} onOpenChange={(open) => !open && setMemberDetails(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Member details</SheetTitle>
            <SheetDescription>Profile and role in this workspace.</SheetDescription>
          </SheetHeader>
          {memberDetails && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14 rounded-xl">
                  <AvatarFallback className="rounded-xl bg-primary/10 text-primary">
                    {getInitials(memberDetails.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-lg">
                    {memberDetails.name ?? "Unnamed user"}
                  </p>
                  <Badge variant="secondary" className="text-xs">
                    {memberDetails.role}
                  </Badge>
                </div>
              </div>
              {memberDetails.email && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</p>
                  <p className="text-sm mt-0.5">{memberDetails.email}</p>
                </div>
              )}
              {memberDetails.skills && memberDetails.skills.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Skills</p>
                  <p className="text-sm mt-0.5">{memberDetails.skills.join(", ")}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Join date</p>
                <p className="text-sm mt-0.5">
                  {memberDetails.joined_at ? new Date(memberDetails.joined_at).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
