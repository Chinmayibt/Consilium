from typing import Any, Dict, List, Optional

import hmac
import hashlib
import json
from urllib.parse import urlencode
import asyncio

import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse

from pydantic import BaseModel

from ..config import settings
from ..database import get_db
from ..dependencies import get_current_user
from ..agents.monitoring_agent import (
    fetch_github_activity,
    build_activity_events,
)


router = APIRouter(prefix="/api", tags=["github"])


@router.get("/github/connect")
async def github_connect(workspace_id: str):
    """
    Redirect the user to GitHub OAuth for repository access.
    """
    if not (settings.GITHUB_CLIENT_ID and settings.GITHUB_REDIRECT_URI):
        raise HTTPException(
            status_code=503,
            detail="GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_REDIRECT_URI in backend .env (create an OAuth App at https://github.com/settings/developers).",
        )

    # Basic state carrying workspace id; in production, add CSRF protection
    state = workspace_id
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": settings.GITHUB_REDIRECT_URI,
        "scope": "repo read:user",
        "state": state,
    }
    url = "https://github.com/login/oauth/authorize?" + urlencode(params)
    return RedirectResponse(url)


@router.get("/github/callback")
async def github_callback(code: str, state: str):
    """
    OAuth callback from GitHub. Exchanges code for access token and stores it
    on the workspace document.
    """
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="GitHub OAuth is not configured on the server",
        )

    workspace_id = state
    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id in state")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
            },
        )
        token_resp.raise_for_status()
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to obtain access token")

        # Fetch basic user info
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_resp.raise_for_status()
        user = user_resp.json()

    db = get_db()
    workspaces = db["workspaces"]
    await workspaces.update_one(
        {"_id": oid},
        {
            "$set": {
                "github": {
                    "access_token": access_token,
                    "user_login": user.get("login"),
                }
            }
        },
    )

    # Redirect to frontend (same origin as the app), not the API
    base = (settings.FRONTEND_URL or "").rstrip("/")
    redirect_url = f"{base}/dashboard/{workspace_id}/integrations?github=connected"
    return RedirectResponse(redirect_url)


async def _get_workspace_and_github(workspace_id: str) -> Dict[str, Any]:
    db = get_db()
    workspaces = db["workspaces"]
    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")

    workspace = await workspaces.find_one({"_id": oid})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    github = workspace.get("github") or {}
    token = github.get("access_token")
    if not token:
        raise HTTPException(
            status_code=400, detail="GitHub is not connected for this workspace"
        )
    return {"workspace": workspace, "github": github, "token": token, "oid": oid}


@router.get("/workspaces/{workspace_id}/github/repos")
async def list_github_repos(
    workspace_id: str, current_user=Depends(get_current_user)
) -> List[Dict[str, Any]]:
    ctx = await _get_workspace_and_github(workspace_id)
    token = ctx["token"]

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user/repos",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        repos = resp.json()

    # Return a trimmed representation
    return [
        {
            "id": r.get("id"),
            "name": r.get("name"),
            "full_name": r.get("full_name"),
            "owner": r.get("owner", {}).get("login"),
            "private": r.get("private"),
        }
        for r in repos
    ]


class RepoSelection(BaseModel):  # type: ignore[name-defined]
    owner: str
    name: str


@router.post("/workspaces/{workspace_id}/github/repo")
async def select_github_repo(
    workspace_id: str,
    payload: RepoSelection,
    current_user=Depends(get_current_user),
):
    ctx = await _get_workspace_and_github(workspace_id)
    oid = ctx["oid"]
    token = ctx["token"]

    async with httpx.AsyncClient() as client:
        repo_resp = await client.get(
            f"https://api.github.com/repos/{payload.owner}/{payload.name}",
            headers={"Authorization": f"Bearer {token}"},
        )
        repo_resp.raise_for_status()
        repo = repo_resp.json()

    db = get_db()
    workspaces = db["workspaces"]
    await workspaces.update_one(
        {"_id": oid},
        {
            "$set": {
                "github.repo_owner": payload.owner,
                "github.repo_name": payload.name,
                "github.repo_full_name": repo.get("full_name"),
                "github.stars": repo.get("stargazers_count"),
                "github.forks": repo.get("forks_count"),
            }
        },
    )

    return {"status": "ok"}


@router.post("/workspaces/{workspace_id}/github/sync-issues")
async def sync_github_issues(
    workspace_id: str,
    current_user=Depends(get_current_user),
):
    ctx = await _get_workspace_and_github(workspace_id)
    workspace = ctx["workspace"]
    oid = ctx["oid"]
    token = ctx["token"]
    github = ctx["github"]

    owner = github.get("repo_owner")
    repo = github.get("repo_name")
    if not owner or not repo:
        raise HTTPException(
            status_code=400, detail="No GitHub repository selected for this workspace"
        )

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/issues",
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        issues = resp.json()

    members = workspace.get("members") or []
    member_ids = [m.get("user_id") for m in members if m.get("user_id")]

    tasks: List[Dict[str, Any]] = workspace.get("tasks") or []

    for issue in issues:
        if "pull_request" in issue:
            # skip PRs here
            continue
        title = issue.get("title") or ""
        body = issue.get("body") or ""
        assignee = issue.get("assignee") or {}
        assignee_login = assignee.get("login")

        status = "done" if issue.get("state") == "closed" else "todo"

        assigned_to: Optional[str] = None
        if assignee_login:
            # naive mapping: match by email-like field or store login only
            assigned_to = assignee_login

        tasks.append(
            {
                "title": title,
                "description": body,
                "assigned_to": assigned_to,
                "status": status,
                "github_issue_number": issue.get("number"),
                "github_issue_url": issue.get("html_url"),
            }
        )

    db = get_db()
    workspaces = db["workspaces"]
    await workspaces.update_one(
        {"_id": oid},
        {"$set": {"tasks": tasks}},
    )

    return {"imported": len(issues)}


@router.get("/workspaces/{workspace_id}/github/activity")
async def github_activity(
    workspace_id: str,
    current_user=Depends(get_current_user),
):
    """
    Activity endpoint used by the UI and monitoring dashboards.

    - Uses the stored GitHub repo configuration from the workspace.
    - Fetches commits and pull requests via the monitoring agent (PyGithub).
    - Persists a generic activity timeline to workspace.activity.
    """
    db = get_db()
    workspaces = db["workspaces"]
    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")

    workspace = await workspaces.find_one({"_id": oid})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    github = workspace.get("github") or {}
    token = github.get("access_token")
    owner = github.get("repo_owner")
    repo = github.get("repo_name")

    # If not fully configured yet, just return an empty activity object
    if not token or not owner or not repo:
        return {"repo": None, "commits": [], "pulls": []}

    # Use monitoring agent (PyGithub) so logic is shared with background loop.
    # Call it in a worker thread so we don't block the event loop.
    repo_summary, commits, pull_requests = await asyncio.to_thread(
        fetch_github_activity, owner, repo, token
    )

    # Store generic activity timeline on the workspace for dashboards
    events = build_activity_events(commits, pull_requests)
    await workspaces.update_one(
        {"_id": oid},
        {
            "$set": {
                "github.repo_full_name": repo_summary.get("full_name"),
                "github.stars": repo_summary.get("stars"),
                "github.forks": repo_summary.get("forks"),
                "github.html_url": repo_summary.get("html_url"),
                "activity": events,
            }
        },
    )

    # Keep response backward-compatible with existing frontend (repo/commits/pulls),
    # while also making pull requests available under a clearer key if needed.
    return {
        "repo": repo_summary,
        "commits": commits[:10],
        "pulls": pull_requests[:10],
        "pull_requests": pull_requests[:10],
    }


@router.post("/github/webhook")
async def github_webhook(request: Request):
    """
    Handle GitHub webhook events for push, pull_request, issues.
    """
    body = await request.body()
    event = request.headers.get("X-GitHub-Event")

    if settings.GITHUB_WEBHOOK_SECRET:
        signature = request.headers.get("X-Hub-Signature-256", "")
        mac = hmac.new(
            settings.GITHUB_WEBHOOK_SECRET.encode("utf-8"),
            msg=body,
            digestmod=hashlib.sha256,
        )
        expected = "sha256=" + mac.hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = json.loads(body.decode("utf-8"))

    if event == "pull_request":
        action = payload.get("action")
        pr = payload.get("pull_request") or {}
        merged = pr.get("merged")
        if action == "closed" and merged:
            # Try to mark linked tasks as done.
            repo = payload.get("repository") or {}
            full_name = repo.get("full_name")
            await _mark_tasks_done_for_pr(full_name, pr)

    # Other events (push, issues) can be handled similarly later.
    return {"status": "ok"}


async def _mark_tasks_done_for_pr(repo_full_name: str | None, pr: Dict[str, Any]):
    """
    Very simple mapping: if any task has github_pr set to this PR number, mark it done.
    """
    if not repo_full_name:
        return

    db = get_db()
    workspaces = db["workspaces"]
    # Find all workspaces using this repo
    cursor = workspaces.find({"github.repo_full_name": repo_full_name})
    async for w in cursor:
        tasks = w.get("tasks") or []
        pr_number = pr.get("number")
        updated = False
        for task in tasks:
            if task.get("github_pr") == pr_number:
                task["status"] = "done"
                updated = True
        if updated:
            await workspaces.update_one(
                {"_id": w["_id"]},
                {"$set": {"tasks": tasks}},
            )

