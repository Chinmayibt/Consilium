"""Replanning agent: reassign blocked tasks, update deadlines, reorder work."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List


def run_replanning(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Reassign blocked tasks to other members, optionally update deadlines.
    Emits task_assigned notifications for each new assignee.
    """
    updates: Dict[str, Any] = {}
    tasks = list(state.get("tasks") or [])
    team_members = list(state.get("team_members") or [])

    if not team_members:
        return updates

    blocked_indices = [i for i, t in enumerate(tasks) if (t.get("status") or "").lower() == "blocked"]
    if not blocked_indices:
        return updates

    member_ids = [m.get("user_id") for m in team_members if m.get("user_id")]
    if not member_ids:
        return updates

    changed = False
    notifications = list(state.get("notifications") or [])
    now_iso = datetime.now(timezone.utc).isoformat()

    for i in blocked_indices:
        t = tasks[i]
        current = str(t.get("assigned_to") or "")
        others = [m for m in member_ids if m != current]
        if others:
            idx = blocked_indices.index(i) % len(others)
            new_assignee = others[idx]
            member = next((m for m in team_members if str(m.get("user_id")) == new_assignee), {})
            title = t.get("title", "Task")
            tasks[i] = {**t, "assigned_to": new_assignee, "assigned_to_name": member.get("name"), "status": "todo"}
            changed = True
            notifications.append({
                "type": "task_assigned",
                "message": f"Task assigned to you: {title}",
                "user_id": new_assignee,
                "read": False,
                "created_at": now_iso,
            })

    if changed:
        updates["tasks"] = tasks
        updates["notifications"] = notifications

    return updates
