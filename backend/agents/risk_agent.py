"""Risk agent: analyze workspace activity and tasks to detect project risks."""
from __future__ import annotations

from datetime import datetime, timezone
import json
from typing import Any, Dict, List

from groq import Groq

from ..config import settings


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_client() -> Groq:
    api_key = getattr(settings, "GROQ_PLANNING_API_KEY", None) or getattr(
        settings, "GROQ_REQUIREMENTS_API_KEY", None
    )
    if not api_key:
        raise RuntimeError("No Groq API key configured")
    return Groq(api_key=api_key)


def analyze_workspace_risks(
    workspace: Dict[str, Any],
    commits: List[Dict[str, Any]] | None = None,
    pull_requests: List[Dict[str, Any]] | None = None,
) -> List[Dict[str, Any]]:
    """
    Analyze recent commits, pull requests, tasks, and deadlines to detect risks.

    Returns a list of risk objects:
    {
        "title": str,
        "description": str,
        "severity": "low" | "medium" | "high",
        "suggested_action": str,
        "created_at": iso datetime
    }
    """
    commits = commits or []
    pull_requests = pull_requests or []
    tasks = workspace.get("tasks") or []
    deadline = workspace.get("deadline")
    team = workspace.get("members") or []

    # If there is no meaningful data yet, return existing risks unchanged
    existing_risks: List[Dict[str, Any]] = list(workspace.get("risks") or [])
    if not commits and not pull_requests and not tasks:
        return existing_risks

    summary = {
        "deadline": str(deadline) if deadline else None,
        "tasks": [
            {
                "title": t.get("title"),
                "status": t.get("status"),
                "assigned_to": t.get("assigned_to_name") or t.get("assigned_to"),
            }
            for t in tasks[:50]
        ],
        "commits": commits[:50],
        "pull_requests": pull_requests[:50],
        "team": [
            {
                "name": m.get("name"),
                "role": m.get("role"),
                "email": m.get("email"),
            }
            for m in team
        ],
    }

    prompt = f"""
You are a senior software project risk analysis agent.

Given the following JSON context about a project, identify concrete delivery or quality risks and propose mitigations.

Context (JSON):
{json.dumps(summary)}

Think about:
- Backend or frontend areas with no recent activity
- Long-running or blocked pull requests
- Tasks that are still "todo" or "blocked" near or past the deadline
- Team members with no recent commits

Respond with **JSON only** in this exact shape:
{{
  "risks": [
    {{
      "title": "Short descriptive title",
      "description": "1-3 sentences explaining the risk and impact",
      "severity": "low" | "medium" | "high",
      "suggested_action": "Concrete next steps to mitigate"
    }}
  ]
}}
If there are no meaningful risks, return {{"risks": []}}.
""".strip()

    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=800,
        )
        text = resp.choices[0].message.content or "{}"
        data = json.loads(text)
        new_risks = data.get("risks") or []
    except Exception:
        # On failure, fall back to a generic medium risk only if we have tasks or PRs
        if not tasks and not pull_requests:
            return existing_risks
        new_risks = [
            {
                "title": "Potential delivery risks",
                "description": "There may be blocked or delayed work based on recent activity. Review open tasks and pull requests.",
                "severity": "medium",
                "suggested_action": "Review blocked or long-running tasks/PRs and reassign or unblock them.",
            }
        ]

    def _risk_key(r: Dict[str, Any]) -> str:
        """Stable key for deduplication: normalized title + first 60 chars of description."""
        title = (r.get("title") or "").strip().lower()[:80]
        desc = (r.get("description") or r.get("impact") or "")[:60]
        return f"{title}|{desc}"

    now_iso = _utc_now_iso()
    enriched = []
    for r in new_risks:
        enriched.append(
            {
                "title": r.get("title") or "Project risk",
                "description": r.get("description")
                or r.get("impact")
                or "Potential delivery or quality risk.",
                "severity": (r.get("severity") or "medium").lower(),
                "suggested_action": r.get("suggested_action")
                or r.get("mitigation")
                or "Review project status and adjust plan.",
                "created_at": r.get("created_at") or now_iso,
            }
        )

    # Merge: update existing by key, append new
    by_key: Dict[str, Dict[str, Any]] = {_risk_key(r): r for r in existing_risks}
    for r in enriched:
        k = _risk_key(r)
        by_key[k] = r  # update in place so severity/mitigation etc. refresh
    return list(by_key.values())

