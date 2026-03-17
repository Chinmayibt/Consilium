from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from ..config import settings
from .monitoring_agent import append_activity_once
from ..services.notification_service import create_notification, trim_activity_log, trim_notifications


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_agent_api_key() -> str | None:
    return settings.REPLANNING_AGENT_KEY


def find_available_member(team: List[Dict[str, Any]], excluded_member_id: str | None = None) -> Dict[str, Any]:
    candidates = [member for member in team if str(member.get("user_id") or member.get("id") or "") != str(excluded_member_id or "")]
    if not candidates:
        return team[0] if team else {}

    def _load(member: Dict[str, Any]) -> int:
        return int(member.get("active_tasks") or 0)

    return sorted(candidates, key=_load)[0]


def replanning_node(state: Dict[str, Any]) -> Dict[str, Any]:
    _get_agent_api_key()
    if state.get("last_replan_hash") == state.get("last_risks_hash"):
        return {
            "last_replan_hash": state.get("last_replan_hash"),
            "replan_changed": False,
        }

    new_tasks: List[Dict[str, Any]] = []
    notifications = list(state.get("notifications") or [])
    team = list(state.get("team") or [])
    kanban = dict(state.get("kanban") or {})
    activity_log = list(state.get("activity_log") or [])
    changed = False

    for task in state.get("tasks") or []:
        updated_task = dict(task)
        task_id = str(updated_task.get("id") or "")
        task_status = kanban.get(task_id, updated_task.get("status") or "todo")

        if task_status == "blocked" and team:
            previous_assignee = str(updated_task.get("assigned_to") or "")
            new_member = find_available_member(team, excluded_member_id=previous_assignee)
            new_member_id = str(new_member.get("user_id") or new_member.get("id") or "")

            if new_member_id:
                updated_task["assigned_to"] = new_member_id
                updated_task["assigned_to_name"] = new_member.get("name") or updated_task.get("assigned_to_name")
                updated_task["status"] = "todo"
                kanban[task_id] = "todo"
                changed = True
                notifications.append(
                    create_notification(
                        new_member_id,
                        f"Task reassigned to {new_member.get('name') or new_member_id}",
                        "task",
                        severity="medium",
                        workspace_id=state.get("workspace_id"),
                    )
                )

        new_tasks.append(updated_task)

    if changed:
        activity_log = append_activity_once(
            activity_log,
            "REPLANNING_TRIGGERED",
            "Replanning agent updated task assignments",
            entity_id=state.get("workspace_id") or "",
            metadata={"risk_hash": state.get("last_risks_hash")},
        )
        recipient_ids = [str(member.get("user_id") or member.get("id") or "") for member in team]
        for recipient_id in [rid for rid in recipient_ids if rid]:
            notifications.append(
                create_notification(
                    recipient_id,
                    "Tasks reassigned due to risks",
                    "replanning",
                    severity="medium",
                    workspace_id=state.get("workspace_id"),
                    event_id=f"replanning:{state.get('last_risks_hash') or ''}:{recipient_id}",
                )
            )

    return {
        "tasks": new_tasks,
        "kanban": kanban,
        "notifications": trim_notifications(notifications),
        "activity_log": trim_activity_log(activity_log),
        "last_replan_hash": state.get("last_risks_hash"),
        "replan_changed": changed,
    }
