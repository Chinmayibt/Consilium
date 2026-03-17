"""Monitoring agent: GitHub activity, task status updates, blocker detection."""
from __future__ import annotations

import re
from typing import Any, Dict, List

import httpx


def run_monitoring(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Monitor GitHub activity and update task statuses.
    - Commit referencing a task -> in_progress
    - PR merged (task.github_pr matches) -> done
    - PR closed unmerged -> blocked
    """
    updates: Dict[str, Any] = {}
    tasks = list(state.get("tasks") or [])
    github_repo = state.get("github_repo") or {}
    token = github_repo.get("access_token")
    owner = github_repo.get("repo_owner")
    repo = github_repo.get("repo_name")
    commits = list(state.get("commits") or [])
    blockers = list(state.get("blockers") or [])

    if not token or not owner or not repo:
        updates["commits"] = []
        return updates

    try:
        with httpx.Client(timeout=10.0) as client:
            # Fetch recent commits
            r = client.get(
                f"https://api.github.com/repos/{owner}/{repo}/commits",
                headers={"Authorization": f"Bearer {token}"},
                params={"per_page": 20},
            )
            if r.is_success:
                commits = r.json()
                updates["commits"] = [
                    {
                        "sha": c.get("sha", "")[:7],
                        "message": (c.get("commit") or {}).get("message", ""),
                        "author": (c.get("commit") or {}).get("author", {}).get("name"),
                    }
                    for c in commits
                ]
            else:
                updates["commits"] = commits

            # Fetch open and closed PRs
            pr_r = client.get(
                f"https://api.github.com/repos/{owner}/{repo}/pulls",
                headers={"Authorization": f"Bearer {token}"},
                params={"state": "all", "per_page": 30},
            )
            if not pr_r.is_success:
                return updates

            prs = pr_r.json()
            task_by_pr: Dict[int, Dict[str, Any]] = {}
            for t in tasks:
                pr_num = t.get("github_pr")
                if pr_num is not None:
                    try:
                        task_by_pr[int(pr_num)] = t
                    except (TypeError, ValueError):
                        pass

            changed = False
            for pr in prs:
                pr_num = pr.get("number")
                merged = pr.get("merged")
                state_str = pr.get("state", "").lower()
                title = pr.get("title") or ""

                if pr_num not in task_by_pr:
                    continue
                task = task_by_pr[pr_num]
                idx = next((i for i, x in enumerate(tasks) if x.get("id") == task.get("id")), None)
                if idx is None:
                    idx = next((i for i, x in enumerate(tasks) if x.get("title") == task.get("title")), None)
                if idx is None:
                    continue

                if merged:
                    tasks[idx]["status"] = "done"
                    changed = True
                elif state_str == "closed":
                    tasks[idx]["status"] = "blocked"
                    blockers.append({
                        "task_id": task.get("id"),
                        "task_title": task.get("title"),
                        "reason": f"PR #{pr_num} closed without merge",
                        "severity": "high",
                    })
                    changed = True

            # Commit message mentioning task title -> in_progress
            for c in commits if isinstance(commits, list) else []:
                msg = (c.get("commit", c) or {}).get("message", "") if isinstance(c, dict) else str(c)
                if isinstance(c, dict) and "message" in c:
                    msg = c["message"]
                for i, t in enumerate(tasks):
                    if t.get("status") == "done":
                        continue
                    title = (t.get("title") or "").lower()
                    if title and len(title) > 10 and title[:20] in msg.lower():
                        tasks[i]["status"] = "in_progress"
                        changed = True
                        break

            if changed:
                updates["tasks"] = tasks
                updates["blockers"] = blockers
    except Exception:
        pass

    # Project complete if all tasks done
    if tasks:
        all_done = all((t.get("status") or "todo") == "done" for t in tasks)
        updates["project_complete"] = all_done

    return updates
