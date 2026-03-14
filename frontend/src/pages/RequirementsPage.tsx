import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { GeneratePrdPayload } from "@/api/workspaces";
import { generateWorkspacePrd } from "@/api/workspaces";

export default function RequirementsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const workspace =
    activeWorkspace ?? workspaces.find((w) => w.id === workspaceId) ?? null;

  const [copied, setCopied] = useState(false);
  const [productName, setProductName] = useState(workspace?.name ?? "");
  const [productDescription, setProductDescription] = useState(
    workspace?.description ?? "",
  );
  const [targetUsers, setTargetUsers] = useState("");
  const [keyFeatures, setKeyFeatures] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [constraints, setConstraints] = useState("");

  const inviteCode = workspace?.invite_code ?? "";

  const handleCopy = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Missing workspace id");
      const payload: GeneratePrdPayload = {
        product_name: productName,
        product_description: productDescription,
        target_users: targetUsers,
        key_features: keyFeatures,
        competitors: competitors || undefined,
        constraints: constraints || undefined,
      };
      await generateWorkspacePrd(workspaceId, payload);
    },
    onSuccess: () => {
      toast.success("PRD generated and roadmap created");
      if (workspaceId) {
        navigate(`/dashboard/${workspaceId}/roadmap`);
      }
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        "Failed to generate PRD.";
      toast.error(msg);
    },
  });

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1>Requirement Analysis</h1>
          {workspace && (
            <p className="text-sm text-muted-foreground mt-1">
              Workspace: <span className="font-medium">{workspace.name}</span>
            </p>
          )}
          {!workspace && (
            <p className="text-sm text-muted-foreground mt-1">
              Describe your product to generate a PRD.
            </p>
          )}
        </div>
      </div>

      {workspace && inviteCode && (
        <div className="card-base mt-4 mb-2 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Invite your team</p>
            <p className="text-xs text-muted-foreground">
              Share this code so teammates can join this workspace.
            </p>
          </div>
          <div className="flex flex-1 gap-2 sm:justify-end">
            <Input
              value={inviteCode}
              readOnly
              className="h-9 font-mono text-xs bg-muted/60 rounded-lg max-w-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg"
              onClick={handleCopy}
              aria-label="Copy invite code"
            >
              <Copy className="h-4 w-4" />
            </Button>
            {copied && (
              <Badge variant="secondary" className="self-center text-[11px]">
                Copied
              </Badge>
            )}
          </div>
        </div>
      )}

      <div className="card-base mt-6 space-y-4 max-w-3xl">
        <h2 className="text-lg font-semibold">Describe your product</h2>
        <p className="text-sm text-muted-foreground">
          Provide a brief description of your product and its users. The AI
          agent will generate a structured PRD.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">Product Name</label>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="ProjectAI"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[13px] font-medium">
              Product Description
            </label>
            <Textarea
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              rows={3}
              className="min-h-[72px]"
              placeholder="What problem does this product solve?"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Target Users</label>
              <Textarea
                value={targetUsers}
                onChange={(e) => setTargetUsers(e.target.value)}
                rows={3}
                className="min-h-[72px]"
                placeholder="e.g. Engineering managers, product managers"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">Key Features</label>
              <Textarea
                value={keyFeatures}
                onChange={(e) => setKeyFeatures(e.target.value)}
                rows={3}
                className="min-h-[72px]"
                placeholder="One feature per line or paragraph"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">
                Competitors{" "}
                <span className="text-xs text-muted-foreground">
                  (optional)
                </span>
              </label>
              <Textarea
                value={competitors}
                onChange={(e) => setCompetitors(e.target.value)}
                rows={3}
                className="min-h-[72px]"
                placeholder="Competing products or solutions"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium">
                Constraints{" "}
                <span className="text-xs text-muted-foreground">
                  (optional)
                </span>
              </label>
              <Textarea
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                rows={3}
                className="min-h-[72px]"
                placeholder="Technical, business, or regulatory constraints"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              className="h-9 rounded-lg"
              disabled={generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending ? "Generating..." : "Generate PRD"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

