"""Replanning agent: reassign blocked tasks, update deadlines, reorder work."""
from __future__ import annotations

from typing import Any, Dict, List


def run_replanning(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Reassign blocked tasks to other members, optionally update deadlines.
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
    for i in blocked_indices:
        t = tasks[i]
        current = str(t.get("assigned_to") or "")
        others = [m for m in member_ids if m != current]
        if others:
            # Round-robin: assign to next member
            idx = blocked_indices.index(i) % len(others)
            new_assignee = others[idx]
            member = next((m for m in team_members if str(m.get("user_id")) == new_assignee), {})
            tasks[i] = {**t, "assigned_to": new_assignee, "assigned_to_name": member.get("name"), "status": "todo"}
            changed = True

    if changed:
        updates["tasks"] = tasks

    return updates
