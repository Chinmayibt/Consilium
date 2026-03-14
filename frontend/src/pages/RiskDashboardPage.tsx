import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchWorkspaceRisks, type WorkspaceRisk } from "@/api/workspaces";

export default function RiskDashboardPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [risks, setRisks] = useState<WorkspaceRisk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRisks = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkspaceRisks(workspaceId);
      setRisks(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load risks.");
      setRisks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!workspaceId) return;
    loadRisks();
  }, [workspaceId]);

  const high = risks.filter((r) => r.severity === "high").length;
  const medium = risks.filter((r) => r.severity === "medium").length;
  const low = risks.filter((r) => r.severity === "low").length;

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div>
        <h1>Risk Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-detected delivery and quality risks for this workspace.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              High
              <Badge variant="destructive" className="text-[10px]">
                Critical
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{high}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              Medium
              <Badge variant="outline" className="text-[10px]">
                Attention
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{medium}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              Low
              <Badge variant="secondary" className="text-[10px]">
                Watch
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{low}</p>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-4xl space-y-3">
        {loading && (
          <p className="text-sm text-muted-foreground">Loading risks...</p>
        )}
        {!loading && risks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No risks detected yet. As the monitoring and planning agents run, new
            risks will appear here.
          </p>
        )}
        {risks.map((risk, i) => {
          const variant =
            risk.severity === "high"
              ? "destructive"
              : risk.severity === "medium"
              ? "outline"
              : "secondary";
          return (
            <div
              key={risk.title + i}
              className="card-base space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold leading-snug">
                  {risk.title}
                </h3>
                <Badge
                  variant={variant as any}
                  className="text-[10px] capitalize"
                >
                  {risk.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {risk.description}
              </p>
              <div className="text-xs">
                <span className="font-medium">Suggested action: </span>
                <span className="text-muted-foreground">
                  {risk.suggested_action}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

