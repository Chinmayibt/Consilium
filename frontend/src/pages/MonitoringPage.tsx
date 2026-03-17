import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Activity,
  CheckCircle2,
  Clock3,
  FolderGit2,
  GitPullRequest,
  Radio,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/api/client";

const API_BASE = api.defaults.baseURL ?? "http://localhost:8000";

interface MonitoringCommit {
  sha?: string;
  id?: string;
  message: string;
  user?: string;
  author?: string;
  timestamp?: string;
}

interface MonitoringPullRequest {
  id?: number;
  number: number;
  title: string;
  state?: string;
  status?: string;
  merged?: boolean;
  user?: string;
}

interface GithubActivityResponse {
  repo: {
    full_name: string;
    stars: number;
    forks: number;
    html_url: string;
  } | null;
  commits: MonitoringCommit[];
  pulls?: MonitoringPullRequest[];
  pull_requests?: MonitoringPullRequest[];
}

function formatTime(value?: string) {
  if (!value) return "Unknown time";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function prStatus(pr: MonitoringPullRequest): string {
  if (pr.status) return pr.status;
  if (pr.merged) return "merged";
  if (pr.state) return pr.state.toLowerCase();
  return "open";
}

export default function MonitoringPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [activity, setActivity] = useState<GithubActivityResponse | null>(null);
  const [commits, setCommits] = useState<MonitoringCommit[]>([]);
  const [pullRequests, setPullRequests] = useState<MonitoringPullRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchActivity = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/github/activity`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to load activity: ${res.status}`);

      const data: GithubActivityResponse = await res.json();
      setActivity(data);
      setCommits(data.commits ?? []);
      setPullRequests(data.pull_requests ?? data.pulls ?? []);
      setLastUpdated(new Date().toISOString());
    } catch (e: any) {
      setError(e?.message ?? "Failed to load activity.");
      setActivity(null);
      setCommits([]);
      setPullRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!workspaceId) return;
    fetchActivity();
    const interval = setInterval(fetchActivity, 30_000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  const repo = activity?.repo ?? null;
  const mergedCount = pullRequests.filter((pr) => prStatus(pr) === "merged").length;
  const openCount = pullRequests.filter((pr) => prStatus(pr) === "open").length;
  const latestCommit = commits[0]?.timestamp;

  const stream = useMemo(
    () =>
      [
        ...commits.slice(0, 5).map((commit) => ({
          id: commit.sha ?? commit.id ?? commit.message,
          type: "commit" as const,
          title: commit.message,
          meta: commit.user || commit.author || "Unknown author",
          time: commit.timestamp,
        })),
        ...pullRequests.slice(0, 4).map((pr) => ({
          id: String(pr.id ?? pr.number ?? pr.title),
          type: "pull" as const,
          title: `#${pr.number} ${pr.title}`,
          meta: pr.user || prStatus(pr),
          time: undefined,
        })),
      ].slice(0, 8),
    [commits, pullRequests],
  );

  return (
    <div className="page-container animate-fade-in space-y-8">
      <section className="hero-panel overflow-hidden p-6 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Badge className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10">
              <Radio className="mr-1 h-3.5 w-3.5" />
              Live GitHub telemetry
            </Badge>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 lg:text-4xl">
              Monitor engineering motion as it happens
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Track commits, pull requests, and repository health in a cleaner command-center view with automatic refresh every 30 seconds.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="rounded-full border-border/70 bg-white/70 px-3 py-1.5 text-[11px]">
              <Clock3 className="mr-1 h-3.5 w-3.5" />
              {lastUpdated ? `Updated ${formatTime(lastUpdated)}` : "Waiting for first sync"}
            </Badge>
            <Button onClick={fetchActivity} disabled={loading} className="rounded-xl">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh now
            </Button>
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Recent commits", value: commits.length, icon: Activity, tone: "text-primary" },
          { label: "Open PRs", value: openCount, icon: GitPullRequest, tone: "text-amber-600" },
          { label: "Merged PRs", value: mergedCount, icon: CheckCircle2, tone: "text-emerald-600" },
          { label: "Last commit", value: latestCommit ? formatTime(latestCommit) : "No activity", icon: Clock3, tone: "text-slate-700" },
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

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="rounded-[28px] border-white/60 bg-white/90 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.28)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Recent commits</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Fresh code changes flowing into the workspace repository.</p>
            </div>
            <Badge variant="outline" className="rounded-full bg-white/70">
              Auto-refresh 30s
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && commits.length === 0 && <p className="text-sm text-muted-foreground">Loading commits...</p>}
            {!loading && commits.length === 0 && <p className="text-sm text-muted-foreground">No recent commits found yet.</p>}
            {commits.map((commit, index) => (
              <div key={commit.sha ?? commit.id ?? index} className="rounded-2xl border border-border/70 bg-slate-50/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-6 text-slate-900">
                      {commit.message || "No commit message"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{commit.user || commit.author || "Unknown author"}</span>
                      <span className="rounded-full bg-white px-2 py-1 font-mono text-[11px]">
                        {(commit.sha ?? commit.id ?? "unknown").slice(0, 7)}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTime(commit.timestamp)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[28px] border-white/60 bg-white/90 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.28)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold">
                <FolderGit2 className="h-4 w-4 text-primary" />
                Repository snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {!repo && <p className="text-muted-foreground">No repository connected yet. Use Integrations to link GitHub.</p>}
              {repo && (
                <>
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                  >
                    {repo.full_name}
                  </a>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Stars</p>
                      <p className="mt-2 text-xl font-extrabold text-slate-900">{repo.stars}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Forks</p>
                      <p className="mt-2 text-xl font-extrabold text-slate-900">{repo.forks}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-white/60 bg-white/90 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.28)]">
            <CardHeader>
              <CardTitle className="text-base font-bold">Signal stream</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stream.length === 0 && <p className="text-sm text-muted-foreground">No live signals yet.</p>}
              {stream.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-slate-50/80 p-4">
                  <div className={`mt-0.5 rounded-2xl p-2 ${item.type === "commit" ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"}`}>
                    {item.type === "commit" ? <Activity className="h-4 w-4" /> : <GitPullRequest className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="rounded-[28px] border-white/60 bg-white/90 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.28)]">
        <CardHeader>
          <CardTitle className="text-base font-bold">Pull requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && pullRequests.length === 0 && <p className="text-sm text-muted-foreground">Loading pull requests...</p>}
          {!loading && pullRequests.length === 0 && <p className="text-sm text-muted-foreground">No pull requests found yet.</p>}
          {pullRequests.map((pr, index) => {
            const status = prStatus(pr);
            const tone =
              status === "merged"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : status === "closed"
                  ? "bg-slate-100 text-slate-700 border-slate-200"
                  : "bg-amber-50 text-amber-700 border-amber-200";

            return (
              <div key={pr.id ?? pr.number ?? index} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-slate-50/70 p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    #{pr.number} {pr.title}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{pr.user || "Unknown author"}</p>
                </div>
                <Badge className={`rounded-full border px-3 py-1 text-[11px] font-semibold capitalize ${tone}`}>
                  {status}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
