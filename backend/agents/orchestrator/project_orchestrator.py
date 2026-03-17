"""
LangGraph project orchestrator: planning -> monitoring -> risk/replan/notification.
Reuses existing planning_agent; does not rewrite requirements_agent or planning_agent.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from langgraph.graph import END, StateGraph
from langgraph.checkpoint.memory import MemorySaver

from .project_state import ProjectState
from .monitoring_agent import run_monitoring
from ..monitoring_agent import dedupe_activity_list
from .risk_agent import run_risk_analysis
from .replanning_agent import run_replanning
from .notification_agent import run_notification
from ..planning_agent import run_planning_agent


def _utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _append_activity(state: ProjectState, action_type: str, description: str, entity_id: str = "", user_id: str = "") -> List[Dict[str, Any]]:
    log = list(state.get("activity_log") or [])
    log.append({
        "action_type": action_type,
        "description": description,
        "user_id": user_id or "",
        "entity_id": entity_id or "",
        "timestamp": _utc_iso(),
    })
    return log


def _build_kanban(tasks: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Group tasks by status: backlog, todo, in_progress, review, blocked, done."""
    columns: Dict[str, List[Dict[str, Any]]] = {
        "backlog": [],
        "todo": [],
        "in_progress": [],
        "review": [],
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
        activity_log = _append_activity(state, "PLAN_GENERATED", "Roadmap and tasks generated from PRD", entity_id=workspace_id)
        for t in tasks:
            task_id = str(t.get("id") or t.get("title", ""))
            activity_log = list(activity_log)
            activity_log.append({
                "action_type": "TASK_CREATED",
                "description": f"Task created: {t.get('title', '')}",
                "user_id": "",
                "entity_id": task_id,
                "timestamp": _utc_iso(),
            })
            if t.get("assigned_to") or t.get("assigned_to_name"):
                activity_log.append({
                    "action_type": "TASK_ASSIGNED",
                    "description": f"Task assigned to {t.get('assigned_to_name', '')}",
                    "user_id": str(t.get("assigned_to") or ""),
                    "entity_id": task_id,
                    "timestamp": _utc_iso(),
                })
        return {
            "roadmap": roadmap,
            "tasks": tasks,
            "kanban": kanban,
            "activity_log": activity_log,
        }
    if tasks and not state.get("kanban"):
        return {"kanban": _build_kanban(tasks)}
    return {}


def monitoring_node(state: ProjectState) -> Dict[str, Any]:
    """Monitor GitHub and task state; detect blockers and project completion."""
    return run_monitoring(state)


def risk_node(state: ProjectState) -> Dict[str, Any]:
    """Analyze blockers and risks; suggest mitigation."""
    out = run_risk_analysis(state)
    log = list(state.get("activity_log") or [])
    if out.get("risks"):
        log.append({
            "action_type": "RISK_UPDATED",
            "description": "Risks analyzed and mitigation suggested",
            "user_id": "",
            "entity_id": state.get("workspace_id", ""),
            "timestamp": _utc_iso(),
        })
        out["activity_log"] = log
    return out


def replanning_node(state: ProjectState) -> Dict[str, Any]:
    """Reassign blocked tasks and adjust deadlines."""
    out = run_replanning(state)
    log = list(state.get("activity_log") or [])
    log.append({
        "action_type": "REPLANNING_TRIGGERED",
        "description": "Schedule and assignments updated due to risks or blockers",
        "user_id": "",
        "entity_id": state.get("workspace_id", ""),
        "timestamp": _utc_iso(),
    })
    out["activity_log"] = log
    notifications = list(out.get("notifications") or state.get("notifications") or [])
    notifications.append({
        "type": "replanning",
        "message": "Schedule updated. Review task assignments and deadlines.",
        "read": False,
        "created_at": _utc_iso(),
    })
    out["notifications"] = notifications
    return out


def notification_node(state: ProjectState) -> Dict[str, Any]:
    """Emit in-app notifications; log project completion to activity."""
    out = run_notification(state)
    if state.get("project_complete"):
        log = list(state.get("activity_log") or [])
        log.append({
            "action_type": "PROJECT_COMPLETED",
            "description": "All tasks completed. Project finished successfully.",
            "user_id": "",
            "entity_id": state.get("workspace_id", ""),
            "timestamp": _utc_iso(),
        })
        out["activity_log"] = log
    return out


def _route_after_monitoring(state: ProjectState) -> str:
    """Route: if blocker or risks -> risk/replan; if project_complete -> notification then end."""
    if state.get("project_complete"):
        return "notification_then_end"
    if state.get("blockers") or (state.get("risks") and (state.get("tasks") or [])):
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
    activity_log = workspace_doc.get("activity_log") or []

    initial: ProjectState = {
        "workspace_id": workspace_id,
        "prd": prd,
        "roadmap": roadmap,
        "tasks": tasks,
        "team_members": members,
        "kanban": workspace_doc.get("kanban") or _build_kanban(tasks),
        "activity_log": activity_log,
        "github_repo": {
            "repo_owner": github.get("repo_owner"),
            "repo_name": github.get("repo_name"),
            "repo_full_name": github.get("repo_full_name"),
            "access_token": github.get("access_token"),
        } if github else {},
        "commits": [],
        "blockers": workspace_doc.get("blockers") or [],
        "risks": workspace_doc.get("risks") or [],
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

    activity_log = final.get("activity_log")
    if activity_log:
        activity_log = dedupe_activity_list(activity_log, window_seconds=60)
    updates: Dict[str, Any] = {
        "roadmap": final.get("roadmap"),
        "tasks": final.get("tasks"),
        "kanban": final.get("kanban"),
        "notifications": final.get("notifications"),
        "activity_log": activity_log,
    }
    if final.get("blockers") is not None:
        updates["blockers"] = final["blockers"]
    if final.get("risks") is not None:
        updates["risks"] = final["risks"]

    await workspaces.update_one(
        {"_id": oid},
        {"$set": {k: v for k, v in updates.items() if v is not None}},
    )
