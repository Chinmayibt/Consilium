from __future__ import annotations

import asyncio
from typing import Any, Dict, List

from bson import ObjectId
from langgraph.graph import END, StateGraph

from ..database import get_db
from .monitoring_agent import build_activity_events, dedupe_activity_list, fetch_github_activity, monitoring_node
from .notification_agent import notification_node
from .planning_agent import run_planning_agent
from .replanning_agent import replanning_node
from .risk_agent import risk_node
from .state import ProjectState
from ..services.notification_service import trim_activity_log, trim_notifications


def _derive_kanban(tasks: List[Dict[str, Any]]) -> Dict[str, str]:
    return {str(task.get("id") or ""): str(task.get("status") or "todo") for task in tasks if task.get("id")}


def _normalize_kanban(kanban: Any, tasks: List[Dict[str, Any]]) -> Dict[str, str]:
    if not isinstance(kanban, dict) or not kanban:
        return _derive_kanban(tasks)

    sample_value = next(iter(kanban.values()))
    if isinstance(sample_value, str):
        return {str(task_id): str(status) for task_id, status in kanban.items()}

    normalized: Dict[str, str] = {}
    for status, items in kanban.items():
        if not isinstance(items, list):
            continue
        for item in items:
            if isinstance(item, dict) and item.get("id"):
                normalized[str(item["id"])] = str(status)
    return normalized or _derive_kanban(tasks)


def planning_node(state: ProjectState) -> Dict[str, Any]:
    roadmap = state.get("roadmap") or {}
    tasks = list(state.get("tasks") or [])

    if roadmap.get("phases") and tasks:
        return {"kanban": _normalize_kanban(state.get("kanban"), tasks)}

    prd = state.get("prd") or {}
    team = list(state.get("team") or [])
    if not prd:
        return {
            "roadmap": roadmap,
            "tasks": tasks,
            "kanban": _normalize_kanban(state.get("kanban"), tasks),
        }

    plan = run_planning_agent(prd, team)
    planned_tasks = plan.get("tasks") or []
    return {
        "roadmap": plan.get("roadmap") or {},
        "tasks": planned_tasks,
        "kanban": _derive_kanban(planned_tasks),
    }


def _route_after_monitor(state: ProjectState) -> str:
    if not state.get("monitoring_changed", True):
        return "end"
    if state.get("project_complete"):
        return "notify"
    if state.get("blockers"):
        return "risk"
    return "end"


def _route_after_risk(state: ProjectState) -> str:
    if not state.get("risks_changed", True):
        return "end"
    risks = state.get("risks") or []
    if any((risk.get("severity") or "").lower() == "high" for risk in risks):
        return "replan"
    if risks:
        return "notify"
    return "end"


def _route_after_replan(state: ProjectState) -> str:
    if not state.get("replan_changed", True):
        return "end"
    return "monitor"


builder = StateGraph(ProjectState)
builder.add_node("plan", planning_node)
builder.add_node("monitor", monitoring_node)
builder.add_node("risk", risk_node)
builder.add_node("replan", replanning_node)
builder.add_node("notify", notification_node)
builder.set_entry_point("plan")
builder.add_edge("plan", "monitor")
builder.add_conditional_edges("monitor", _route_after_monitor, {"risk": "risk", "notify": "notify", "end": END})
builder.add_conditional_edges("risk", _route_after_risk, {"replan": "replan", "notify": "notify", "end": END})
builder.add_conditional_edges("replan", _route_after_replan, {"monitor": "monitor", "end": END})
builder.add_edge("notify", END)
graph = builder.compile()


def build_graph_state(
    workspace_id: str,
    workspace: Dict[str, Any],
    github_events: List[Dict[str, Any]] | None = None,
) -> ProjectState:
    tasks = list(workspace.get("tasks") or [])
    team = list(workspace.get("members") or workspace.get("team") or [])
    github = workspace.get("github") or {}
    existing_processed = workspace.get("processed_event_ids") or [
        item.get("event_id") for item in (workspace.get("processed_events") or []) if item.get("event_id")
    ]

    return {
        "workspace_id": workspace_id,
        "prd": workspace.get("prd") or {},
        "team": team,
        "roadmap": workspace.get("roadmap") or {},
        "tasks": tasks,
        "github_events": github_events or [],
        "kanban": _normalize_kanban(workspace.get("kanban"), tasks),
        "risks": workspace.get("risks") or [],
        "notifications": workspace.get("notifications") or [],
        "project_complete": bool(workspace.get("project_complete")),
        "blockers": workspace.get("blockers") or [],
        "github_repo": {
            "repo_owner": github.get("repo_owner"),
            "repo_name": github.get("repo_name"),
            "repo_full_name": github.get("repo_full_name"),
            "access_token": github.get("access_token"),
        },
        "activity_log": workspace.get("activity_log") or [],
        "processed_event_ids": [event_id for event_id in existing_processed if event_id],
        "last_monitoring_hash": workspace.get("last_monitoring_hash"),
        "last_risks_hash": workspace.get("last_risks_hash"),
        "last_replan_hash": workspace.get("last_replan_hash"),
        "monitoring_changed": False,
        "risks_changed": False,
        "replan_changed": False,
    }


async def run_graph_for_workspace(
    workspace_id: str,
    github_events: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    db = get_db()
    workspaces = db["workspaces"]
    oid = ObjectId(workspace_id)
    workspace = await workspaces.find_one({"_id": oid})
    if not workspace:
        return {}

    initial_state = build_graph_state(workspace_id, workspace, github_events=github_events)
    final_state = graph.invoke(initial_state)

    tasks = list(final_state.get("tasks") or [])
    kanban = dict(final_state.get("kanban") or _derive_kanban(tasks))
    for task in tasks:
        task_id = str(task.get("id") or "")
        if task_id and task_id in kanban:
            task["status"] = kanban[task_id]

    updates: Dict[str, Any] = {
        "roadmap": final_state.get("roadmap") or {},
        "tasks": tasks,
        "kanban": kanban,
        "blockers": final_state.get("blockers") or [],
        "risks": list(final_state.get("risks") or []),
        "notifications": trim_notifications(final_state.get("notifications") or []),
        "project_complete": bool(final_state.get("project_complete")),
        "activity_log": trim_activity_log(dedupe_activity_list(final_state.get("activity_log") or [], window_seconds=60)),
        "processed_event_ids": final_state.get("processed_event_ids") or [],
        "github_events": final_state.get("github_events") or [],
        "last_monitoring_hash": final_state.get("last_monitoring_hash"),
        "last_risks_hash": final_state.get("last_risks_hash"),
        "last_replan_hash": final_state.get("last_replan_hash"),
    }

    github_repo = final_state.get("github_repo") or {}
    if github_repo.get("repo_full_name"):
        updates["github.repo_full_name"] = github_repo["repo_full_name"]

    await workspaces.update_one({"_id": oid}, {"$set": updates})
    return final_state


async def _run_monitoring_once() -> None:
    db = get_db()
    workspaces = db["workspaces"]

    cursor = workspaces.find({"github.access_token": {"$exists": True}})
    async for workspace in cursor:
        github: Dict[str, Any] = workspace.get("github") or {}
        owner = github.get("repo_owner")
        repo_name = github.get("repo_name")
        token = github.get("access_token")
        if not (owner and repo_name and token):
            continue

        try:
            repo_summary, commits, pull_requests = await asyncio.to_thread(fetch_github_activity, owner, repo_name, token)
        except Exception:
            continue

        github_events: List[Dict[str, Any]] = [*commits, *pull_requests]
        activity = build_activity_events(commits, pull_requests)

        await workspaces.update_one(
            {"_id": workspace["_id"]},
            {
                "$set": {
                    "activity": activity,
                    "github.repo_full_name": repo_summary.get("full_name"),
                    "github.stars": repo_summary.get("stars"),
                    "github.forks": repo_summary.get("forks"),
                    "github.html_url": repo_summary.get("html_url"),
                }
            },
        )

        await run_graph_for_workspace(str(workspace["_id"]), github_events=github_events)


async def monitoring_loop(poll_interval_seconds: int = 30) -> None:
    await asyncio.sleep(5)
    while True:
        try:
            await _run_monitoring_once()
        except Exception as exc:
            print("Monitoring loop error:", exc)
        await asyncio.sleep(poll_interval_seconds)
