import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileDown, Pencil, FileText } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import type { Prd } from "@/api/workspaces";
import {
  fetchWorkspacePrd,
  saveWorkspacePrd,
  finalizeWorkspacePrd,
  downloadWorkspacePrdMarkdown,
  downloadWorkspacePrdPdf,
} from "@/api/workspaces";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function PrdPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const workspace =
    activeWorkspace ?? workspaces.find((w) => w.id === workspaceId) ?? null;
  const [prd, setPrd] = useState<Prd | null>(null);
  const [status, setStatus] = useState<"draft" | "final">("draft");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { isLoading } = useQuery({
    queryKey: ["workspace-prd", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return null;
      const data = await fetchWorkspacePrd(workspaceId);
      setPrd(data.prd);
      setStatus((data.status === "final" ? "final" : "draft"));
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !prd) return;
      await saveWorkspacePrd(workspaceId, prd);
      await finalizeWorkspacePrd(workspaceId);
    },
    onSuccess: () => {
      toast.success("PRD finalized and roadmap generated");
      setStatus("final");
      queryClient.invalidateQueries({ queryKey: ["workspace-prd", workspaceId] });
      if (workspaceId) {
        navigate(`/dashboard/${workspaceId}/roadmap`);
      }
    },
    onError: () => {
      toast.error("Failed to save PRD.");
    },
  });

  const handleDownload = async (type: "pdf" | "markdown") => {
    if (!workspaceId) return;
    try {
      const blob =
        type === "pdf"
          ? await downloadWorkspacePrdPdf(workspaceId)
          : await downloadWorkspacePrdMarkdown(workspaceId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        type === "pdf"
          ? `workspace-${workspaceId}-prd.pdf`
          : `workspace-${workspaceId}-prd.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ??
        err?.message ??
        "Failed to download PRD.";
      toast.error(msg);
    }
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1>Product Requirements Document</h1>
          {workspace && (
            <p className="text-sm text-muted-foreground mt-1">
              Workspace: <span className="font-medium">{workspace.name}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              status === "final"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {status === "final" ? "Final PRD" : "Draft"}
          </span>
        <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload("pdf")}
              disabled={!prd}
            >
              <FileDown className="h-3.5 w-3.5 mr-1.5" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload("markdown")}
              disabled={!prd}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Markdown
            </Button>
          </div>
        </div>
      </div>

      {isLoading && (
        <p className="mt-4 text-sm text-muted-foreground">Loading PRD...</p>
      )}

      {!isLoading && !prd && (
        <p className="mt-4 text-sm text-muted-foreground">
          No PRD found for this workspace yet. Generate one from the
          Requirements page.
        </p>
      )}

      {prd && (
        <div className="mt-6 max-w-4xl">
          <div className="card-base p-6 max-h-[70vh] overflow-y-auto space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Product Overview</h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.overview}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev ? { ...prev, overview: e.target.value } : prev,
                    )
                  }
                  className="min-h-[120px]"
                />
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {prd.overview}
                </p>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                2. Problem Statement
              </h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.problem_statement}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? { ...prev, problem_statement: e.target.value }
                        : prev,
                    )
                  }
                  className="min-h-[120px]"
                />
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {prd.problem_statement}
                </p>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">3. Target Users</h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.target_users.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            target_users: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[100px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.target_users.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">4. Market Analysis</h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.market_analysis.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            market_analysis: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[120px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.market_analysis.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">5. Key Features</h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.features.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            features: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[120px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">6. User Stories</h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.user_stories.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            user_stories: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[140px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.user_stories.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                7. Functional Requirements
              </h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.functional_requirements.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            functional_requirements: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[160px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.functional_requirements.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                8. Non-Functional Requirements
              </h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.non_functional_requirements.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            non_functional_requirements: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[160px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.non_functional_requirements.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                9. Technical Architecture
              </h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.system_architecture.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            system_architecture: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[140px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.system_architecture.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                10. Recommended Tech Stack
              </h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.tech_stack.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            tech_stack: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[120px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.tech_stack.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                11. Database Design
              </h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.database_design.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            database_design: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[140px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.database_design.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">12. API Design</h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.api_design.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            api_design: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[140px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.api_design.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                13. Security Considerations
              </h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.security.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            security: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[120px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.security.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                14. Performance Considerations
              </h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.performance.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            performance: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[120px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.performance.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                15. Deployment Strategy
              </h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.deployment.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            deployment: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[120px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.deployment.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                16. Project Folder Structure
              </h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.folder_structure.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            folder_structure: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[120px]"
                />
              ) : (
                <pre className="text-xs text-muted-foreground whitespace-pre">
                  {prd.folder_structure.join("\n")}
                </pre>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">17. Milestones</h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.milestones.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            milestones: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[120px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.milestones.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">18. MVP Scope</h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.mvp_scope.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            mvp_scope: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[120px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.mvp_scope.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">
                19. Future Enhancements
              </h2>
              {status === "draft" ? (
                <Textarea
                  value={prd.future_enhancements.join("\n")}
                  onChange={(e) =>
                    setPrd((prev) =>
                      prev
                        ? {
                            ...prev,
                            future_enhancements: e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : prev,
                    )
                  }
                  className="min-h-[120px]"
                />
              ) : (
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {prd.future_enhancements.map((r, i) => (
                    <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            </section>
          </div>

          {status === "draft" && (
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                className="h-9 rounded-lg"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? "Finalizing..." : "Save PRD"}
              </Button>
            </div>
          )}
      </div>
      )}
    </div>
  );
}
