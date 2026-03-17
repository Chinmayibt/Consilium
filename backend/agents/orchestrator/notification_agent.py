"""Notification agent: in-app notifications for task assigned, completed, blockers, etc."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List


def _new_notification(ntype: str, message: str, **kwargs: Any) -> Dict[str, Any]:
    return {
        "type": ntype,
        "message": message,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        **kwargs,
    }


def run_notifications(state: Dict[str, Any], kind: str = "general") -> Dict[str, Any]:
    """
    Append in-app notifications. Does not send email in this stub.
    kind: "task_assigned" | "task_completed" | "blocker_detected" | "task_reassigned" | "project_completed" | "general"
    """
    updates: Dict[str, Any] = {}
    notifications = list(state.get("notifications") or [])

    if kind == "project_completed" and state.get("project_complete"):
        notifications.append(_new_notification(
            "project_completed",
            "🎉 Project Completed\n\nAll tasks have been successfully finished.",
        ))
        updates["notifications"] = notifications
    elif kind == "blocker_detected" and (state.get("blockers") or state.get("risks")):
        for b in (state.get("blockers") or [])[:5]:
            task_title = b.get("task_title") or "Task"
            reason = b.get("reason", "Blocker detected")
            severity = b.get("severity", "high")
            notifications.append(_new_notification(
                "blocker",
                f"⚠ Blocker detected\nTask: {task_title}\nCause: {reason}\nSeverity: {severity.title()}",
            ))
        if state.get("risks"):
            for r in (state.get("risks") or [])[:3]:
                msg = r.get("impact") or r.get("description") or "Risk identified"
                notifications.append(_new_notification("risk", msg, severity=r.get("severity", "medium")))
        updates["notifications"] = notifications

    return updates


def run_notification(state: Dict[str, Any]) -> Dict[str, Any]:
    """Single entry used by orchestrator: pick kind from state and append notifications."""
    if state.get("project_complete"):
        return run_notifications(state, "project_completed")
    if state.get("blockers") or state.get("risks"):
        return run_notifications(state, "blocker_detected")
    return run_notifications(state, "general")
