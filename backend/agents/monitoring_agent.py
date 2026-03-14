"""Monitoring agent: fetch GitHub commits and pull requests for a workspace."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from github import Github


def _to_iso(dt) -> str:
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    return str(dt)


def fetch_github_activity(
    owner: str,
    repo_name: str,
    token: str,
    max_commits: int = 20,
    max_prs: int = 20,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Fetch recent commits and pull requests for the given repo using PyGithub.

    Returns (repo_summary, commits, pull_requests), where commits and pull_requests
    are plain dicts suitable for JSON serialization and storage.
    """
    gh = Github(token, per_page=max(max_commits, max_prs))
    repo = gh.get_repo(f"{owner}/{repo_name}")

    # Repo summary
    repo_summary: Dict[str, Any] = {
        "full_name": repo.full_name,
        "stars": repo.stargazers_count,
        "forks": repo.forks_count,
        "html_url": repo.html_url,
    }

    commits: List[Dict[str, Any]] = []
    for i, c in enumerate(repo.get_commits()):
        if i >= max_commits:
            break
        try:
            message = c.commit.message
            author_login = (
                c.author.login
                if c.author is not None
                else (c.commit.author.name if c.commit and c.commit.author else None)
            )
            commits.append(
                {
                    "sha": (c.sha or "")[:7],
                    "message": message,
                    "user": author_login,
                    "timestamp": _to_iso(
                        c.commit.author.date if c.commit and c.commit.author else None
                    ),
                }
            )
        except Exception:
            continue

    pull_requests: List[Dict[str, Any]] = []
    for i, pr in enumerate(repo.get_pulls(state="all")):
        if i >= max_prs:
            break
        try:
            pull_requests.append(
                {
                    "number": pr.number,
                    "title": pr.title,
                    "user": pr.user.login if pr.user is not None else None,
                    "state": pr.state,
                    "merged": pr.merged,
                    "created_at": _to_iso(pr.created_at),
                    "closed_at": _to_iso(pr.closed_at) if pr.closed_at else None,
                    "html_url": pr.html_url,
                }
            )
        except Exception:
            continue

    return repo_summary, commits, pull_requests


def build_activity_events(
    commits: List[Dict[str, Any]],
    pull_requests: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Convert commits and PRs into generic activity events stored on workspace.activity.
    """
    events: List[Dict[str, Any]] = []
    for c in commits:
        events.append(
            {
                "type": "commit",
                "title": c.get("message"),
                "user": c.get("user"),
                "timestamp": c.get("timestamp"),
                "task_id": None,
            }
        )
    for pr in pull_requests:
        events.append(
            {
                "type": "pull_request",
                "title": pr.get("title"),
                "user": pr.get("user"),
                "timestamp": pr.get("created_at"),
                "task_id": None,
            }
        )
    # Most recent first by timestamp if present
    def _key(e: Dict[str, Any]):
        ts = e.get("timestamp")
        return ts or ""

    events.sort(key=_key, reverse=True)
    return events

