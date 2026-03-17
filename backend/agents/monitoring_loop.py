from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Dict

from bson import ObjectId

from ..database import get_db
from .monitoring_agent import (
    fetch_github_activity,
    build_activity_events,
    apply_github_activity_to_tasks,
    dedupe_activity_append,
)
from .risk_agent import analyze_workspace_risks
from .orchestrator.project_orchestrator import _build_kanban


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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

        # Processed events: skip GitHub events we already handled (avoid duplicate activity/task updates)
        processed_events = list(w.get("processed_events") or [])
        processed_ids = {e.get("event_id") for e in processed_events if e.get("event_id")}
        MAX_PROCESSED_EVENTS = 500
        if len(processed_events) > MAX_PROCESSED_EVENTS:
            processed_events = processed_events[-MAX_PROCESSED_EVENTS:]
            processed_ids = {e.get("event_id") for e in processed_events if e.get("event_id")}

        # Apply GitHub activity to tasks (each event processed at most once)
        w_tasks = list(w.get("tasks") or [])
        updated_tasks, new_activity, newly_processed = await asyncio.to_thread(
            apply_github_activity_to_tasks,
            w_tasks,
            commits,
            pull_requests,
            processed_ids,
        )
        for eid in newly_processed:
            processed_events.append({
                "event_id": eid,
                "platform": "github",
                "processed_at": _utc_iso(),
            })
        if len(processed_events) > MAX_PROCESSED_EVENTS:
            processed_events = processed_events[-MAX_PROCESSED_EVENTS:]

        activity_log = list(w.get("activity_log") or [])
        activity_log = dedupe_activity_append(activity_log, new_activity, window_seconds=60)
        activity_log = dedupe_activity_append(activity_log, [{
            "action_type": "MONITORING_TICK",
            "description": "Monitoring agent updated task states from GitHub",
            "user_id": "",
            "entity_id": str(w["_id"]),
            "timestamp": _utc_iso(),
        }], window_seconds=60)

        # Run risk analysis on workspace with updated tasks
        workspace_with_tasks = {**w, "tasks": updated_tasks}
        risks = await asyncio.to_thread(
            analyze_workspace_risks, workspace_with_tasks, commits, pull_requests
        )

        try:
            oid = ObjectId(w["_id"])
        except Exception:
            continue

        activity_log = dedupe_activity_append(activity_log, [{
            "action_type": "RISK_UPDATED",
            "description": "Risks updated from monitoring",
            "user_id": "",
            "entity_id": str(w["_id"]),
            "timestamp": _utc_iso(),
        }], window_seconds=60)

        kanban = _build_kanban(updated_tasks)
        await workspaces.update_one(
            {"_id": oid},
            {
                "$set": {
                    "github.repo_full_name": repo_summary.get("full_name"),
                    "github.stars": repo_summary.get("stars"),
                    "github.forks": repo_summary.get("forks"),
                    "github.html_url": repo_summary.get("html_url"),
                    "activity": events,
                    "tasks": updated_tasks,
                    "kanban": kanban,
                    "risks": risks,
                    "activity_log": activity_log,
                    "processed_events": processed_events,
                }
            },
        )

        # Trigger replanning when risks exist so orchestrator can run risk -> replan -> notification
        if risks and (w.get("tasks") or w.get("prd")):
            try:
                from .orchestrator.project_orchestrator import start_project_graph
                await start_project_graph(str(w["_id"]))
            except Exception:
                pass


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

