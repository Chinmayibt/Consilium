import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  if (!value) return "";
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

  const fetchActivity = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/workspaces/${workspaceId}/github/activity`,
        {
          credentials: "include",
        },
      );
      if (!res.ok) {
        throw new Error(`Failed to load activity: ${res.status}`);
      }
      const data: GithubActivityResponse = await res.json();
      setActivity(data);
      setCommits(data.commits ?? []);
      const prs = data.pull_requests ?? data.pulls ?? [];
      setPullRequests(prs);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  const repo = activity?.repo ?? null;

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div>
        <h1>Monitoring</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live GitHub activity for this workspace&apos;s repository.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3 max-w-6xl">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Repository</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {loading && !repo && (
              <p className="text-muted-foreground text-xs">
                Loading repository info...
              </p>
            )}
            {!loading && !repo && (
              <p className="text-muted-foreground text-xs">
                No repository connected. Go to Integrations to connect GitHub.
              </p>
            )}
            {repo && (
              <>
                <a
                  href={repo.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs underline-offset-2 hover:underline break-all"
                >
                  {repo.full_name}
                </a>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>⭐ {repo.stars} stars</span>
                  <span>🍴 {repo.forks} forks</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Recent Commits</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              Auto-refreshing every 30s
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && commits.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Loading commits...
              </p>
            )}
            {!loading && commits.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No recent commits found.
              </p>
            )}
            {commits.map((commit, i) => (
              <div
                key={commit.sha ?? commit.id ?? i}
                className="flex flex-col gap-0.5 border-b border-border/60 last:border-0 pb-2 last:pb-0"
              >
                <div className="text-sm font-medium leading-snug">
                  {commit.message || "No commit message"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {(commit.user || commit.author || "Unknown author") +
                    (commit.timestamp
                      ? ` • ${formatTime(commit.timestamp)}`
                      : "")}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="max-w-6xl">
        <CardHeader>
          <CardTitle className="text-sm">Pull Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && pullRequests.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Loading pull requests...
            </p>
          )}
          {!loading && pullRequests.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No pull requests found.
            </p>
          )}
          {pullRequests.map((pr, i) => {
            const status = prStatus(pr);
            const variant =
              status === "merged"
                ? "secondary"
                : status === "closed"
                ? "outline"
                : "default";
            return (
              <div
                key={pr.id ?? pr.number ?? i}
                className="flex items-center justify-between gap-3 border-b border-border/60 last:border-0 pb-2 last:pb-0"
              >
                <div className="space-y-0.5">
                  <div className="text-sm font-medium leading-snug">
                    #{pr.number} {pr.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {pr.user || "Unknown author"}
                  </div>
                </div>
                <Badge variant={variant as any} className="text-[10px] capitalize">
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

