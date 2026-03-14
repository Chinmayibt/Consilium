"""Notification agent: in-app notifications for task assigned, completed, blockers, etc."""
from __future__ import annotations

from typing import Any, Dict, List


def run_notifications(state: Dict[str, Any], kind: str = "general") -> Dict[str, Any]:
    """
    Append in-app notifications. Does not send email in this stub.
    kind: "task_assigned" | "task_completed" | "blocker_detected" | "task_reassigned" | "project_completed" | "general"
    """
    updates: Dict[str, Any] = {}
    notifications = list(state.get("notifications") or [])

    if kind == "project_completed" and state.get("project_complete"):
        notifications.append({
            "type": "project_completed",
            "message": "All tasks are complete. Project is done.",
        })
        updates["notifications"] = notifications
    elif kind == "blocker_detected" and (state.get("blockers") or state.get("risks")):
        for b in (state.get("blockers") or [])[:3]:
            notifications.append({"type": "blocker", "message": b.get("reason", "Blocker detected")})
        updates["notifications"] = notifications

    return updates


def run_notification(state: Dict[str, Any]) -> Dict[str, Any]:
    """Single entry used by orchestrator: pick kind from state and append notifications."""
    if state.get("project_complete"):
        return run_notifications(state, "project_completed")
    if state.get("blockers") or state.get("risks"):
        return run_notifications(state, "blocker_detected")
    return run_notifications(state, "general")
