import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Github, Clock, GitBranch } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/client";

const API_BASE = api.defaults.baseURL ?? "http://localhost:8000";

interface GithubRepoSummary {
  full_name: string;
  stars: number;
  forks: number;
  html_url: string;
}

interface GithubActivity {
  repo: GithubRepoSummary | null;
  commits: any[];
  pulls: any[];
}

interface RepoOption {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  private?: boolean;
}

export default function IntegrationsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activity, setActivity] = useState<GithubActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<RepoOption[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [savingRepo, setSavingRepo] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [showChangeRepo, setShowChangeRepo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadActivity = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<GithubActivity>(
        `/api/workspaces/${workspaceId}/github/activity`,
      );
      setActivity(data);
    } catch {
      setActivity(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, [workspaceId]);

  const fetchRepos = async () => {
    if (!workspaceId) return;
    setLoadingRepos(true);
    setError(null);
    try {
      const { data } = await api.get<RepoOption[]>(
        `/api/workspaces/${workspaceId}/github/repos`,
      );
      setRepos(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0 && !selectedRepo) {
        setSelectedRepo(data[0].full_name);
      }
    } catch (err) {
      setError("Failed to load repositories. Make sure GitHub is connected.");
      setRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  };

  useEffect(() => {
    const githubConnected =
      searchParams.get("github") === "connected" ||
      searchParams.get("github_connected") === "true";
    if (workspaceId && githubConnected) {
      toast.success("GitHub connected successfully");
      fetchRepos();
      setSearchParams({}, { replace: true });
    }
  }, [workspaceId, searchParams.get("github"), searchParams.get("github_connected")]);

  const connectGithub = () => {
    if (!workspaceId) return;
    // Full redirect to backend OAuth endpoint; auth is preserved via localStorage.
    window.location.href = `${API_BASE}/api/github/connect?workspace_id=${workspaceId}`;
  };

  const saveRepo = async () => {
    if (!workspaceId || !selectedRepo) return;
    const [owner, name] = selectedRepo.split("/");
    if (!owner || !name) return;
    setSavingRepo(true);
    setError(null);
    try {
      await api.post(`/api/workspaces/${workspaceId}/github/repo`, {
        owner,
        name,
      });
      await loadActivity();
      setRepos([]);
      setSelectedRepo("");
      setShowChangeRepo(false);
    } catch {
      setError("Failed to save repository.");
    } finally {
      setSavingRepo(false);
    }
  };

  const showRepoSelector =
    repos.length > 0 && !loadingRepos && (!activity?.repo || showChangeRepo);
  const isConnected = !!activity?.repo;

  return (
    <div className="page-container animate-fade-in space-y-6">
      <div>
        <h1>Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect GitHub to sync issues, commits, and pull requests.
        </p>
      </div>

      <div className="grid gap-4 max-w-4xl">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Github className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm">GitHub Repository</CardTitle>
                <p className="caption">
                  Connect a GitHub repository to this workspace.
                </p>
              </div>
            </div>
            {isConnected ? (
              <Badge variant="secondary" className="bg-success/10 text-success text-[10px]">
                ● GitHub Connected
              </Badge>
            ) : (
              <Button size="sm" onClick={connectGithub}>
                Connect GitHub
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Checking GitHub status...
              </p>
            )}

            {!loading && isConnected && (
              <div className="space-y-1">
                <p className="text-sm font-medium">GitHub Repository Connected</p>
                <p className="text-sm text-muted-foreground">
                  Repository:{" "}
                  <a
                    href={activity.repo!.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono underline-offset-2 hover:underline"
                  >
                    {activity.repo!.full_name}
                  </a>
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>⭐ {activity.repo!.stars} stars</span>
                  <span>🍴 {activity.repo!.forks} forks</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setShowChangeRepo(true);
                    fetchRepos();
                  }}
                  disabled={loadingRepos}
                >
                  {loadingRepos ? "Loading…" : "Change repository"}
                </Button>
              </div>
            )}

            {showChangeRepo && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowChangeRepo(false);
                  setRepos([]);
                  setSelectedRepo("");
                }}
              >
                Cancel
              </Button>
            )}

            {showRepoSelector && (
              <div className="space-y-3">
                <Label>Select Repository</Label>
                <Select
                  value={selectedRepo}
                  onValueChange={setSelectedRepo}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a repository" />
                  </SelectTrigger>
                  <SelectContent>
                    {repos.map((repo) => (
                      <SelectItem
                        key={repo.id}
                        value={repo.full_name}
                      >
                        {repo.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={saveRepo}
                  disabled={savingRepo || !selectedRepo}
                >
                  {savingRepo ? "Saving…" : "Save repository"}
                </Button>
              </div>
            )}

            {!loading && !isConnected && !showRepoSelector && (
              <p className="text-xs text-muted-foreground">
                No repository connected yet. Click &quot;Connect GitHub&quot; to
                authenticate, then choose a repository to link.
              </p>
            )}

            {loadingRepos && !showRepoSelector && !isConnected && (
              <p className="text-xs text-muted-foreground">
                Loading your repositories…
              </p>
            )}

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
