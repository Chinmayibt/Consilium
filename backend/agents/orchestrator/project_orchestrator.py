"""
LangGraph project orchestrator: planning -> monitoring -> risk/replan/notification.
Reuses existing planning_agent; does not rewrite requirements_agent or planning_agent.
"""
from __future__ import annotations

from typing import Any, Dict, List

from langgraph.graph import END, StateGraph
from langgraph.checkpoint.memory import MemorySaver

from .project_state import ProjectState
from .monitoring_agent import run_monitoring
from .risk_agent import run_risk_analysis
from .replanning_agent import run_replanning
from .notification_agent import run_notification
from ..planning_agent import run_planning_agent


def _build_kanban(tasks: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Group tasks by status into kanban columns."""
    columns: Dict[str, List[Dict[str, Any]]] = {
        "todo": [],
        "in_progress": [],
        "blocked": [],
        "done": [],
    }
    for t in tasks:
        status = (t.get("status") or "todo").lower()
        if status in columns:
            columns[status].append(t)
        else:
            columns["todo"].append(t)
    return columns


def planning_node(state: ProjectState) -> Dict[str, Any]:
    """First node: run planning agent if roadmap not yet generated; otherwise pass through."""
    workspace_id = state.get("workspace_id") or ""
    prd = state.get("prd")
    roadmap = state.get("roadmap")
    tasks = state.get("tasks") or []
    team_members = state.get("team_members") or []

    if prd and (not roadmap or not (roadmap.get("phases"))):
        plan = run_planning_agent(prd, team_members)
        roadmap = plan.get("roadmap") or {}
        if isinstance(roadmap, dict) and "roadmap" in roadmap:
            roadmap = roadmap.get("roadmap") or roadmap
        tasks = plan.get("tasks") or []
        kanban = _build_kanban(tasks)
        return {
            "roadmap": roadmap,
            "tasks": tasks,
            "kanban": kanban,
        }
    if tasks and not state.get("kanban"):
        return {"kanban": _build_kanban(tasks)}
    return {}


def monitoring_node(state: ProjectState) -> Dict[str, Any]:
    """Monitor GitHub and task state; detect blockers and project completion."""
    return run_monitoring(state)


def risk_node(state: ProjectState) -> Dict[str, Any]:
    """Analyze blockers and risks; suggest mitigation."""
    return run_risk_analysis(state)


def replanning_node(state: ProjectState) -> Dict[str, Any]:
    """Reassign blocked tasks and adjust deadlines."""
    return run_replanning(state)


def notification_node(state: ProjectState) -> Dict[str, Any]:
    """Emit in-app notifications."""
    return run_notification(state)


def _route_after_monitoring(state: ProjectState) -> str:
    """Route: if blocker -> risk; if project_complete -> end; else end (next tick can run again)."""
    if state.get("project_complete"):
        return "notification_then_end"
    if state.get("blockers"):
        return "risk"
    return "end"


def _route_after_notification(state: ProjectState) -> str:
    """After notification: end."""
    return "end"


def get_graph():
    """Build and return the compiled LangGraph."""
    workflow = StateGraph(ProjectState)

    workflow.add_node("planning", planning_node)
    workflow.add_node("monitoring", monitoring_node)
    workflow.add_node("risk", risk_node)
    workflow.add_node("replanning", replanning_node)
    workflow.add_node("notification", notification_node)

    workflow.set_entry_point("planning")
    workflow.add_edge("planning", "monitoring")
    workflow.add_conditional_edges("monitoring", _route_after_monitoring, {
        "risk": "risk",
        "notification_then_end": "notification",
        "end": END,
    })
    workflow.add_edge("risk", "replanning")
    workflow.add_edge("replanning", "notification")
    workflow.add_edge("notification", END)

    memory = MemorySaver()
    return workflow.compile(checkpointer=memory)


_graph = None


def get_project_graph():
    global _graph
    if _graph is None:
        _graph = get_graph()
    return _graph


def run_project_tick(workspace_id: str, workspace_doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Run one orchestrator tick: load state from workspace_doc, run graph, return updated state.
    Caller is responsible for persisting to DB.
    """
    prd = workspace_doc.get("prd")
    roadmap = workspace_doc.get("roadmap") or {}
    tasks = workspace_doc.get("tasks") or []
    members = workspace_doc.get("members") or []
    github = workspace_doc.get("github") or {}
    notifications = workspace_doc.get("notifications") or []

    initial: ProjectState = {
        "workspace_id": workspace_id,
        "prd": prd,
        "roadmap": roadmap,
        "tasks": tasks,
        "team_members": members,
        "kanban": workspace_doc.get("kanban") or _build_kanban(tasks),
        "github_repo": {
            "repo_owner": github.get("repo_owner"),
            "repo_name": github.get("repo_name"),
            "repo_full_name": github.get("repo_full_name"),
            "access_token": github.get("access_token"),
        } if github else {},
        "commits": [],
        "blockers": [],
        "risks": [],
        "notifications": notifications,
        "project_complete": False,
    }

    graph = get_project_graph()
    config = {"configurable": {"thread_id": workspace_id}}
    # Run without checkpoint for a simple one-shot invocation
    final = graph.invoke(initial, config=config)
    return final


async def start_project_graph(workspace_id: str) -> None:
    """
    Entry point called after finalize-prd: run one orchestrator tick and persist to DB.
    Uses async Motor for DB access.
    """
    from ...database import get_db
    from bson import ObjectId

    db = get_db()
    workspaces = db["workspaces"]
    try:
        oid = ObjectId(workspace_id)
    except Exception:
        return

    workspace = await workspaces.find_one({"_id": oid})
    if not workspace:
        return

    final = run_project_tick(workspace_id, workspace)

    updates: Dict[str, Any] = {
        "roadmap": final.get("roadmap"),
        "tasks": final.get("tasks"),
        "kanban": final.get("kanban"),
        "notifications": final.get("notifications"),
    }
    if final.get("blockers") is not None:
        updates["blockers"] = final["blockers"]
    if final.get("risks") is not None:
        updates["risks"] = final["risks"]

    await workspaces.update_one(
        {"_id": oid},
        {"$set": {k: v for k, v in updates.items() if v is not None}},
    )
