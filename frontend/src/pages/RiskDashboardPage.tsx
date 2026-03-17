import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Siren,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchWorkspaceRisks, type WorkspaceRisk } from "@/api/workspaces";

function severityTone(severity: WorkspaceRisk["severity"]) {
  if (severity === "high") return "border-rose-200 bg-rose-50 text-rose-700";
  if (severity === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

export default function RiskDashboardPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [risks, setRisks] = useState<WorkspaceRisk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadRisks = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkspaceRisks(workspaceId);
      setRisks(data ?? []);
      setLastUpdated(new Date().toISOString());
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
    const interval = setInterval(loadRisks, 30_000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  const counts = useMemo(
    () => ({
      high: risks.filter((risk) => risk.severity === "high").length,
      medium: risks.filter((risk) => risk.severity === "medium").length,
      low: risks.filter((risk) => risk.severity === "low").length,
    }),
    [risks],
  );

  const topRisk = risks[0] ?? null;

  return (
    <div className="page-container animate-fade-in space-y-8">
      <section className="hero-panel overflow-hidden p-6 lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Badge className="rounded-full bg-rose-500/10 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-500/10">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              AI risk radar
            </Badge>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 lg:text-4xl">
              Spot delivery threats before they slow the team
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              High-signal visibility into what the agents think could affect delivery, quality, or momentum.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="rounded-full bg-white/70 px-3 py-1.5 text-[11px]">
              {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : "Waiting for first scan"}
            </Badge>
            <Button onClick={loadRisks} disabled={loading} className="rounded-xl">
              Refresh risks
            </Button>
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "High severity", value: counts.high, icon: Siren, tone: "text-rose-700" },
          { label: "Medium severity", value: counts.medium, icon: AlertTriangle, tone: "text-amber-700" },
          { label: "Low severity", value: counts.low, icon: CheckCircle2, tone: "text-emerald-700" },
          { label: "Total signals", value: risks.length, icon: ShieldAlert, tone: "text-slate-800" },
        ].map((item) => (
          <div key={item.label} className="card-base">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-950">
                  {item.value}
                </p>
              </div>
              <div className={`rounded-2xl bg-slate-50 p-3 ${item.tone}`}>
                <item.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <Card className="rounded-[28px] border-white/60 bg-white/90 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.28)]">
          <CardHeader>
            <CardTitle className="text-base font-bold">Top priority</CardTitle>
          </CardHeader>
          <CardContent>
            {!topRisk ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
                No meaningful risks detected yet. As monitoring and planning run, this panel will highlight the most urgent concern.
              </div>
            ) : (
              <div className="rounded-[24px] border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-white p-5">
                <Badge className={`rounded-full border px-3 py-1 text-[11px] font-semibold capitalize ${severityTone(topRisk.severity)}`}>
                  {topRisk.severity} severity
                </Badge>
                <h2 className="mt-4 text-xl font-extrabold tracking-tight text-slate-950">
                  {topRisk.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {topRisk.description}
                </p>
                <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Suggested response
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {topRisk.suggested_action}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {loading && <p className="text-sm text-muted-foreground">Loading risks...</p>}
          {!loading && risks.length === 0 && (
            <div className="card-base text-sm text-muted-foreground">
              No risks detected yet. As the monitoring and planning agents run, new risks will appear here.
            </div>
          )}

          {risks.map((risk, index) => (
            <Card key={`${risk.title}-${index}`} className="rounded-[24px] border-white/60 bg-white/90 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.35)]">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-950">
                        {risk.title}
                      </h3>
                      <Badge className={`rounded-full border px-3 py-1 text-[11px] font-semibold capitalize ${severityTone(risk.severity)}`}>
                        {risk.severity}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {risk.description}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                    {risk.created_at ? new Date(risk.created_at).toLocaleString() : "Recently detected"}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-border/70 bg-slate-50/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Suggested action
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {risk.suggested_action}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
