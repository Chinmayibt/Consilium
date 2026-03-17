"""Monitoring agent: fetch GitHub activity, map it to tasks, and update kanban."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Set, Tuple

from github import Github

from ..config import settings
from ..services.notification_service import create_notification, trim_activity_log, trim_notifications


def _to_iso(dt) -> str:
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    return str(dt)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_agent_api_key() -> str | None:
    return settings.MONITORING_AGENT_KEY


def _stable_hash(value: Any) -> str:
    try:
        payload = json.dumps(value, sort_keys=True, default=str)
    except Exception:
        payload = str(value)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def append_activity_once(
    activity_log: List[Dict[str, Any]],
    action_type: str,
    description: str,
    entity_id: str = "",
    user_id: str = "",
    metadata: Dict[str, Any] | None = None,
) -> List[Dict[str, Any]]:
    event_id = _stable_hash({"action_type": action_type, "description": description, "entity_id": entity_id})
    recent_ids = {str(entry.get("event_id") or "") for entry in activity_log[-20:] if entry.get("event_id")}
    if event_id in recent_ids:
        return trim_activity_log(activity_log)

    next_log = list(activity_log)
    next_log.append(
        {
            "event_id": event_id,
            "action_type": action_type,
            "description": description,
            "user_id": user_id,
            "entity_id": entity_id,
            "timestamp": _utc_now_iso(),
            **(metadata or {}),
        }
    )
    return trim_activity_log(next_log)


def fetch_github_activity(
    owner: str,
    repo_name: str,
    token: str,
    max_commits: int = 20,
    max_prs: int = 20,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
    gh = Github(token, per_page=max(max_commits, max_prs))
    repo = gh.get_repo(f"{owner}/{repo_name}")

    repo_summary: Dict[str, Any] = {
        "full_name": repo.full_name,
        "stars": repo.stargazers_count,
        "forks": repo.forks_count,
        "html_url": repo.html_url,
    }

    commits: List[Dict[str, Any]] = []
    for idx, commit in enumerate(repo.get_commits()):
        if idx >= max_commits:
            break
        try:
            commits.append(
                {
                    "id": f"github:commit:{(commit.sha or '')[:12]}",
                    "type": "commit",
                    "sha": (commit.sha or "")[:12],
                    "message": commit.commit.message,
                    "user": commit.author.login if commit.author is not None else (commit.commit.author.name if commit.commit and commit.commit.author else None),
                    "timestamp": _to_iso(commit.commit.author.date if commit.commit and commit.commit.author else None),
                }
            )
        except Exception:
            continue

    pull_requests: List[Dict[str, Any]] = []
    for idx, pr in enumerate(repo.get_pulls(state="all")):
        if idx >= max_prs:
            break
        try:
            pull_requests.append(
                {
                    "id": f"github:pr:{pr.number}:{'merged' if pr.merged else pr.state}",
                    "type": "pull_request",
                    "number": pr.number,
                    "title": pr.title,
                    "message": pr.title,
                    "user": pr.user.login if pr.user is not None else None,
                    "state": pr.state,
                    "merged": pr.merged,
                    "timestamp": _to_iso(pr.updated_at or pr.created_at),
                    "created_at": _to_iso(pr.created_at),
                    "closed_at": _to_iso(pr.closed_at) if pr.closed_at else None,
                    "html_url": pr.html_url,
                }
            )
        except Exception:
            continue

    return repo_summary, commits, pull_requests


def build_activity_events(
    commits: List[Dict[str, Any]],
    pull_requests: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    events = [
        {
            "type": event.get("type"),
            "title": event.get("message") or event.get("title"),
            "user": event.get("user"),
            "timestamp": event.get("timestamp"),
            "task_id": event.get("task_id"),
        }
        for event in [*commits, *pull_requests]
    ]
    events.sort(key=lambda item: item.get("timestamp") or "", reverse=True)
    return events


def map_commit_to_task(event: Dict[str, Any], tasks: List[Dict[str, Any]]) -> str | None:
    message = (event.get("message") or event.get("title") or "").lower()
    pr_number = event.get("number")

    for task in tasks:
        task_id = str(task.get("id") or "")
        title = (task.get("title") or "").lower()

        if task_id and task_id.lower() in message:
            return task_id
        if title and len(title) > 8 and title[:24] in message:
            return task_id
        if pr_number is not None and str(task.get("github_pr") or "") == str(pr_number):
            return task_id

    return None


def _event_id_pr(pr_num: Any, merged: bool) -> str:
    return f"github:pr:{pr_num}:{'merged' if merged else 'closed'}"


def _event_id_commit(sha: str) -> str:
    return f"github:commit:{sha}"


def apply_github_activity_to_tasks(
    tasks: List[Dict[str, Any]],
    commits: List[Dict[str, Any]],
    pull_requests: List[Dict[str, Any]],
    processed_event_ids: Set[str] | None = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[str]]:
    processed = processed_event_ids or set()
    now = _utc_now_iso()
    activity: List[Dict[str, Any]] = []
    updated_tasks = [dict(task) for task in tasks]
    task_index = {str(task.get("id") or ""): idx for idx, task in enumerate(updated_tasks)}
    newly_processed: List[str] = []

    for pr in pull_requests:
        pr_num = pr.get("number")
        event_id = _event_id_pr(pr_num, bool(pr.get("merged")))
        if event_id in processed:
            continue
        task_id = map_commit_to_task(pr, updated_tasks)
        if not task_id or task_id not in task_index:
            continue
        idx = task_index[task_id]
        if pr.get("merged"):
            updated_tasks[idx]["status"] = "done"
            activity.append({"action_type": "COMMIT_DETECTED", "description": f"PR #{pr_num} merged -> task marked done: {updated_tasks[idx].get('title', '')}", "user_id": "", "entity_id": task_id, "timestamp": now})
        elif (pr.get("state") or "").lower() == "closed":
            updated_tasks[idx]["status"] = "blocked"
            activity.append({"action_type": "BLOCKER_DETECTED", "description": f"PR #{pr_num} closed unmerged -> task blocked: {updated_tasks[idx].get('title', '')}", "user_id": "", "entity_id": task_id, "timestamp": now})
        else:
            updated_tasks[idx]["status"] = "in_progress"
        newly_processed.append(event_id)

    for commit in commits:
        sha = (commit.get("sha") or "")[:12]
        if not sha:
            continue
        event_id = _event_id_commit(sha)
        if event_id in processed:
            continue
        task_id = map_commit_to_task(commit, updated_tasks)
        if not task_id or task_id not in task_index:
            continue
        idx = task_index[task_id]
        updated_tasks[idx]["status"] = "in_progress"
        activity.append({"action_type": "COMMIT_DETECTED", "description": f"Commit references task {task_id} -> in progress: {updated_tasks[idx].get('title', '')}", "user_id": commit.get("user") or "", "entity_id": task_id, "timestamp": now})
        newly_processed.append(event_id)

    return updated_tasks, activity, newly_processed


def monitoring_node(state: Dict[str, Any]) -> Dict[str, Any]:
    _get_agent_api_key()
    if state.get("project_complete"):
        return {"monitoring_changed": False}

    github_repo = state.get("github_repo") or {}
    tasks = [dict(task) for task in state.get("tasks") or []]
    kanban = dict(state.get("kanban") or {})
    processed_event_ids = set(state.get("processed_event_ids") or [])
    blockers = list(state.get("blockers") or [])
    activity_log = list(state.get("activity_log") or [])
    notifications = list(state.get("notifications") or [])
    workspace_members = list(state.get("team") or [])

    events = list(state.get("github_events") or [])
    commits = [event for event in events if event.get("type") == "commit"]
    pull_requests = [event for event in events if event.get("type") == "pull_request"]

    if not events and github_repo.get("access_token") and github_repo.get("repo_owner") and github_repo.get("repo_name"):
        _, commits, pull_requests = fetch_github_activity(
            github_repo["repo_owner"],
            github_repo["repo_name"],
            github_repo["access_token"],
        )
        events = [*commits, *pull_requests]

    activity_hash = _stable_hash(events)
    if activity_hash == state.get("last_monitoring_hash"):
        return {
            "last_monitoring_hash": activity_hash,
            "monitoring_changed": False,
        }

    task_lookup = {str(task.get("id") or ""): idx for idx, task in enumerate(tasks)}
    updates: List[Dict[str, Any]] = []
    new_processed_event_ids: List[str] = []
    status_changed = False

    for event in events:
        event_id = str(event.get("id") or event.get("event_id") or "")
        if event_id and event_id in processed_event_ids:
            continue

        task_id = map_commit_to_task(event, tasks)
        if not task_id or task_id not in task_lookup:
            if event_id:
                new_processed_event_ids.append(event_id)
            continue

        idx = task_lookup[task_id]
        previous_status = str(tasks[idx].get("status") or kanban.get(task_id) or "todo")
        message = (event.get("message") or event.get("title") or "").lower()
        task_status = "in_progress"

        if event.get("type") == "pull_request" and event.get("merged"):
            task_status = "done"
        elif "fix" in message or "done" in message or "complete" in message:
            task_status = "done"
        elif "wip" in message or "progress" in message:
            task_status = "in_progress"
        elif "error" in message or "fail" in message or "blocked" in message:
            task_status = "blocked"
            blockers.append(
                {
                    "task_id": task_id,
                    "task_title": tasks[idx].get("title"),
                    "message": event.get("message") or event.get("title") or "Task blocked by GitHub activity",
                    "event_id": event_id,
                    "severity": "high",
                }
            )

        kanban[task_id] = task_status
        tasks[idx]["status"] = task_status
        updates.append({**event, "task_id": task_id})
        if event_id:
            new_processed_event_ids.append(event_id)

        if previous_status != task_status:
            status_changed = True
            actor = event.get("user") or "A contributor"
            activity_log = append_activity_once(
                activity_log,
                "TASK_STATUS_CHANGED",
                f"{tasks[idx].get('title') or task_id} moved to {task_status}",
                entity_id=task_id,
                user_id=str(actor),
                metadata={"source_event_id": event_id, "task_status": task_status},
            )
            activity_log = append_activity_once(
                activity_log,
                "COMMIT_DETECTED",
                f"New commit detected from {actor}",
                entity_id=task_id,
                user_id=str(actor),
                metadata={"source_event_id": event_id},
            )

            recipient_ids = [str(member.get("user_id") or member.get("id") or "") for member in workspace_members]
            for recipient_id in [rid for rid in recipient_ids if rid]:
                notifications.append(
                    create_notification(
                        recipient_id,
                        f"New commit pushed by {actor}",
                        "commit",
                        workspace_id=state.get("workspace_id"),
                        event_id=_stable_hash({"type": "commit", "task_id": task_id, "actor": actor, "source_event_id": event_id}),
                    )
                )
                notifications.append(
                    create_notification(
                        recipient_id,
                        f"Task moved to {task_status}",
                        "task",
                        workspace_id=state.get("workspace_id"),
                        event_id=_stable_hash({"type": "task", "task_id": task_id, "status": task_status, "source_event_id": event_id}),
                    )
                )

    all_done = bool(tasks) and all(kanban.get(str(task.get("id") or ""), task.get("status") or "todo") == "done" for task in tasks)

    return {
        "github_events": updates or events,
        "kanban": kanban,
        "tasks": tasks,
        "blockers": blockers,
        "project_complete": all_done,
        "processed_event_ids": list(processed_event_ids.union(new_processed_event_ids)),
        "activity_log": trim_activity_log(activity_log),
        "notifications": trim_notifications(notifications),
        "last_monitoring_hash": activity_hash,
        "monitoring_changed": bool(status_changed or updates or blockers),
    }


def _parse_iso(ts: str) -> datetime | None:
    try:
        if "Z" in ts or ts.endswith("+00:00"):
            return datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return datetime.fromisoformat(ts)
    except Exception:
        return None


def dedupe_activity_append(
    existing_log: List[Dict[str, Any]],
    new_entries: List[Dict[str, Any]],
    window_seconds: int = 60,
) -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    recent_keys: set = set()
    for entry in reversed(existing_log[-100:]):
        ts = entry.get("timestamp")
        if not ts:
            continue
        parsed = _parse_iso(ts)
        if parsed is None:
            continue
        if (now - parsed).total_seconds() > window_seconds:
            break
        recent_keys.add((entry.get("action_type") or "", entry.get("entity_id") or "", (entry.get("description") or "")[:80]))

    out = list(existing_log)
    for entry in new_entries:
        key = (entry.get("action_type") or "", entry.get("entity_id") or "", (entry.get("description") or "")[:80])
        if key in recent_keys:
            continue
        recent_keys.add(key)
        out.append(entry)
    return out


def dedupe_activity_list(
    entries: List[Dict[str, Any]],
    window_seconds: int = 60,
) -> List[Dict[str, Any]]:
    result: List[Dict[str, Any]] = []
    for entry in entries:
        key = (entry.get("action_type") or "", entry.get("entity_id") or "", (entry.get("description") or "")[:80])
        ts = entry.get("timestamp")
        parsed = _parse_iso(ts) if ts else None
        is_dup = False
        for existing in result[-50:]:
            existing_ts = existing.get("timestamp")
            existing_parsed = _parse_iso(existing_ts) if existing_ts else None
            existing_key = (existing.get("action_type") or "", existing.get("entity_id") or "", (existing.get("description") or "")[:80])
            if parsed is not None and existing_parsed is not None and key == existing_key and abs((parsed - existing_parsed).total_seconds()) <= window_seconds:
                is_dup = True
                break
        if not is_dup:
            result.append(entry)
    return result
