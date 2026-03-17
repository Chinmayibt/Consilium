"""Monitoring agent: fetch GitHub commits and pull requests for a workspace."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Set, Tuple

from github import Github


def _to_iso(dt) -> str:
    if isinstance(dt, datetime):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    return str(dt)


def fetch_github_activity(
    owner: str,
    repo_name: str,
    token: str,
    max_commits: int = 20,
    max_prs: int = 20,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Fetch recent commits and pull requests for the given repo using PyGithub.

    Returns (repo_summary, commits, pull_requests), where commits and pull_requests
    are plain dicts suitable for JSON serialization and storage.
    """
    gh = Github(token, per_page=max(max_commits, max_prs))
    repo = gh.get_repo(f"{owner}/{repo_name}")

    # Repo summary
    repo_summary: Dict[str, Any] = {
        "full_name": repo.full_name,
        "stars": repo.stargazers_count,
        "forks": repo.forks_count,
        "html_url": repo.html_url,
    }

    commits: List[Dict[str, Any]] = []
    for i, c in enumerate(repo.get_commits()):
        if i >= max_commits:
            break
        try:
            message = c.commit.message
            author_login = (
                c.author.login
                if c.author is not None
                else (c.commit.author.name if c.commit and c.commit.author else None)
            )
            commits.append(
                {
                    "sha": (c.sha or "")[:7],
                    "message": message,
                    "user": author_login,
                    "timestamp": _to_iso(
                        c.commit.author.date if c.commit and c.commit.author else None
                    ),
                }
            )
        except Exception:
            continue

    pull_requests: List[Dict[str, Any]] = []
    for i, pr in enumerate(repo.get_pulls(state="all")):
        if i >= max_prs:
            break
        try:
            pull_requests.append(
                {
                    "number": pr.number,
                    "title": pr.title,
                    "user": pr.user.login if pr.user is not None else None,
                    "state": pr.state,
                    "merged": pr.merged,
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
    """
    Convert commits and PRs into generic activity events stored on workspace.activity.
    """
    events: List[Dict[str, Any]] = []
    for c in commits:
        events.append(
            {
                "type": "commit",
                "title": c.get("message"),
                "user": c.get("user"),
                "timestamp": c.get("timestamp"),
                "task_id": None,
            }
        )
    for pr in pull_requests:
        events.append(
            {
                "type": "pull_request",
                "title": pr.get("title"),
                "user": pr.get("user"),
                "timestamp": pr.get("created_at"),
                "task_id": None,
            }
        )
    # Most recent first by timestamp if present
    def _key(e: Dict[str, Any]):
        ts = e.get("timestamp")
        return ts or ""

    events.sort(key=_key, reverse=True)
    return events


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
    """
    Update task status based on GitHub activity. Process each event at most once (by event_id).
    Returns (updated_tasks, activity_entries_to_append, processed_event_ids_used).
    """
    from datetime import datetime, timezone

    processed = processed_event_ids or set()
    newly_processed: List[str] = []
    tasks = [dict(t) for t in tasks]
    activity: List[Dict[str, Any]] = []
    now = datetime.now(timezone.utc).isoformat()

    task_by_pr: Dict[int, int] = {}
    for i, t in enumerate(tasks):
        pr_num = t.get("github_pr")
        if pr_num is not None:
            try:
                task_by_pr[int(pr_num)] = i
            except (TypeError, ValueError):
                pass

    for pr in pull_requests:
        pr_num = pr.get("number")
        if pr_num not in task_by_pr:
            continue
        merged = pr.get("merged")
        state_str = (pr.get("state") or "").lower()
        eid = _event_id_pr(pr_num, merged)
        if eid in processed:
            continue
        idx = task_by_pr[pr_num]
        t = tasks[idx]
        if merged:
            if (t.get("status") or "").lower() != "done":
                tasks[idx]["status"] = "done"
                activity.append({
                    "action_type": "COMMIT_DETECTED",
                    "description": f"PR #{pr_num} merged → task marked done: {t.get('title', '')}",
                    "user_id": "",
                    "entity_id": str(t.get("id") or ""),
                    "timestamp": now,
                })
                newly_processed.append(eid)
        elif state_str == "closed":
            if (t.get("status") or "").lower() != "blocked":
                tasks[idx]["status"] = "blocked"
                activity.append({
                    "action_type": "BLOCKER_DETECTED",
                    "description": f"PR #{pr_num} closed unmerged → task blocked: {t.get('title', '')}",
                    "user_id": "",
                    "entity_id": str(t.get("id") or ""),
                    "timestamp": now,
                })
                newly_processed.append(eid)

    for c in commits:
        sha = (c.get("sha") or "")[:12]
        if not sha:
            continue
        eid = _event_id_commit(sha)
        if eid in processed:
            continue
        msg = (c.get("message") or "").lower()
        if not msg:
            continue
        for i, t in enumerate(tasks):
            if (t.get("status") or "").lower() in ("done", "blocked"):
                continue
            task_id = str(t.get("id") or "")
            title = (t.get("title") or "").lower()
            if task_id and task_id in msg:
                tasks[i]["status"] = "in_progress"
                activity.append({
                    "action_type": "COMMIT_DETECTED",
                    "description": f"Commit references task {task_id} → in progress: {t.get('title', '')}",
                    "user_id": c.get("user") or "",
                    "entity_id": task_id,
                    "timestamp": now,
                })
                newly_processed.append(eid)
                break
            if len(title) > 10 and title[:20] in msg:
                tasks[i]["status"] = "in_progress"
                activity.append({
                    "action_type": "COMMIT_DETECTED",
                    "description": f"Commit references task → in progress: {t.get('title', '')}",
                    "user_id": c.get("user") or "",
                    "entity_id": str(t.get("id") or ""),
                    "timestamp": now,
                })
                newly_processed.append(eid)
                break

    return tasks, activity, newly_processed


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
    """
    Append new_entries to existing_log, skipping duplicates.
    Duplicate = same action_type + entity_id + description prefix already present within window_seconds.
    """
    now = datetime.now(timezone.utc)
    recent_keys: set = set()
    for e in reversed(existing_log[-100:]):
        ts = e.get("timestamp")
        if not ts:
            continue
        t = _parse_iso(ts)
        if t is None:
            continue
        if (now - t).total_seconds() > window_seconds:
            break
        key = (e.get("action_type") or "", e.get("entity_id") or "", (e.get("description") or "")[:80])
        recent_keys.add(key)
    out = list(existing_log)
    for e in new_entries:
        key = (e.get("action_type") or "", e.get("entity_id") or "", (e.get("description") or "")[:80])
        if key in recent_keys:
            continue
        recent_keys.add(key)
        out.append(e)
    return out


def dedupe_activity_list(
    entries: List[Dict[str, Any]],
    window_seconds: int = 60,
) -> List[Dict[str, Any]]:
    """
    Remove duplicate activity entries. Keep first occurrence; drop later duplicates
    with same (action_type, entity_id, description prefix) within window_seconds.
    """
    result: List[Dict[str, Any]] = []
    for e in entries:
        key = (e.get("action_type") or "", e.get("entity_id") or "", (e.get("description") or "")[:80])
        ts = e.get("timestamp")
        t = _parse_iso(ts) if ts else None
        is_dup = False
        for r in result[-50:]:
            rts = r.get("timestamp")
            rt = _parse_iso(rts) if rts else None
            if rt is None or t is None:
                continue
            rkey = (r.get("action_type") or "", r.get("entity_id") or "", (r.get("description") or "")[:80])
            if rkey == key and abs((t - rt).total_seconds()) <= window_seconds:
                is_dup = True
                break
        if not is_dup:
            result.append(e)
    return result

