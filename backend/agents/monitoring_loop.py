from __future__ import annotations

import asyncio
from typing import Any, Dict

from bson import ObjectId

from ..database import get_db
from .monitoring_agent import fetch_github_activity, build_activity_events
from .risk_agent import analyze_workspace_risks


async def _run_once() -> None:
    db = get_db()
    workspaces = db["workspaces"]

    cursor = workspaces.find({"github.access_token": {"$exists": True}})
    async for w in cursor:
        github: Dict[str, Any] = w.get("github") or {}
        owner = github.get("repo_owner")
        repo_name = github.get("repo_name")
        token = github.get("access_token")
        if not (owner and repo_name and token):
            continue

        try:
            # Fetch GitHub activity (commits, PRs)
            repo_summary, commits, pull_requests = await asyncio.to_thread(
                fetch_github_activity, owner, repo_name, token
            )
        except Exception:
            continue

        # Build generic activity timeline
        events = build_activity_events(commits, pull_requests)

        # Run risk analysis based on current workspace + new activity
        risks = await asyncio.to_thread(
            analyze_workspace_risks, w, commits, pull_requests
        )

        try:
            oid = ObjectId(w["_id"])
        except Exception:
            continue

        await workspaces.update_one(
            {"_id": oid},
            {
                "$set": {
                    "github.repo_full_name": repo_summary.get("full_name"),
                    "github.stars": repo_summary.get("stars"),
                    "github.forks": repo_summary.get("forks"),
                    "github.html_url": repo_summary.get("html_url"),
                    "activity": events,
                    "risks": risks,
                }
            },
        )


async def monitoring_loop(poll_interval_seconds: int = 30) -> None:
    """
    Background monitoring loop: periodically updates GitHub activity and risks
    for all workspaces that have GitHub configured.
    """
    # Small initial delay so the app can start
    await asyncio.sleep(5)
    while True:
        try:
            await _run_once()
        except Exception as e:
            # Best-effort background loop; log and continue
            print("Monitoring loop error:", e)
        await asyncio.sleep(poll_interval_seconds)

