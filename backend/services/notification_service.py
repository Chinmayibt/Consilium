from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List
import uuid

from ..database import get_db

ACTIVITY_LOG_LIMIT = 20
NOTIFICATION_LIMIT = 30


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_notification(
    user_id: str | None,
    message: str,
    notification_type: str,
    **kwargs: Any,
) -> Dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "message": message,
        "type": notification_type,
        "read": False,
        "created_at": utc_now_iso(),
        **kwargs,
    }


def trim_activity_log(activity_log: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return list(activity_log)[-ACTIVITY_LOG_LIMIT:]


def trim_notifications(notifications: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return list(notifications)[-NOTIFICATION_LIMIT:]


async def reset_workspace_signal_data_once() -> None:
    db = get_db()
    flags = db["system_flags"]
    existing = await flags.find_one({"_id": "workspace-signal-reset-v1"})
    if existing:
        return

    workspaces = db["workspaces"]
    await workspaces.update_many(
        {},
        {
            "$set": {
                "activity_log": [],
                "risks": [],
                "notifications": [],
                "blockers": [],
                "github_events": [],
                "last_monitoring_hash": None,
                "last_risks_hash": None,
                "last_replan_hash": None,
            }
        },
    )

    users = db["users"]
    await users.update_many({}, {"$set": {"notifications": []}})

    await flags.insert_one({"_id": "workspace-signal-reset-v1", "completed_at": utc_now_iso()})
