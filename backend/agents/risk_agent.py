"""Risk agent: analyze workspace activity and blockers to detect project risks."""
from __future__ import annotations

from datetime import datetime, timezone
import json
from typing import Any, Dict, List

from groq import Groq

from ..config import settings
from .monitoring_agent import _stable_hash, append_activity_once
from ..services.notification_service import create_notification, trim_activity_log, trim_notifications


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_client() -> Groq:
    api_key = (
        getattr(settings, "RISK_AGENT_KEY", None)
        or getattr(settings, "GROQ_PLANNING_API_KEY", None)
        or getattr(settings, "GROQ_REQUIREMENTS_API_KEY", None)
    )
    if not api_key:
        raise RuntimeError("No risk-agent API key configured")
    return Groq(api_key=api_key)


def _risk_key(risk: Dict[str, Any]) -> str:
    title = (risk.get("title") or "").strip().lower()[:80]
    desc = (risk.get("description") or risk.get("impact") or "").strip().lower()[:80]
    task_id = str(risk.get("task_id") or "")
    return f"{task_id}|{title}|{desc}"


def _risk_id(risk_type: str, description: str) -> str:
    normalized = (description or "").strip().lower()[:50]
    return f"{risk_type}-{normalized}"


def _normalize_risk(risk: Dict[str, Any], now_iso: str, default_type: str = "project") -> Dict[str, Any]:
    risk_type = str(risk.get("type") or default_type)
    description = str(risk.get("description") or risk.get("impact") or "Potential delivery or quality risk.")
    return {
        "id": risk.get("id") or _risk_id(risk_type, description),
        "type": risk_type,
        "title": risk.get("title") or "Project risk",
        "description": description,
        "severity": (risk.get("severity") or "medium").lower(),
        "suggested_action": risk.get("suggested_action") or risk.get("mitigation") or "Review project status and adjust plan.",
        "created_at": risk.get("created_at") or now_iso,
        "task_id": risk.get("task_id"),
    }


def analyze_workspace_risks(
    workspace: Dict[str, Any],
    commits: List[Dict[str, Any]] | None = None,
    pull_requests: List[Dict[str, Any]] | None = None,
) -> List[Dict[str, Any]]:
    commits = commits or []
    pull_requests = pull_requests or []
    tasks = workspace.get("tasks") or []
    team = workspace.get("members") or workspace.get("team") or []
    if not commits and not pull_requests and not tasks:
        return []

    summary = {
        "tasks": [
            {
                "title": task.get("title"),
                "status": task.get("status"),
                "assigned_to": task.get("assigned_to_name") or task.get("assigned_to"),
                "deadline": task.get("deadline"),
            }
            for task in tasks[:50]
        ],
        "commits": commits[:50],
        "pull_requests": pull_requests[:50],
        "team": [{"name": member.get("name"), "role": member.get("role")} for member in team[:20]],
    }

    prompt = f"""
You are a senior software project risk analysis agent.

Given the following JSON context about a project, identify concrete delivery or quality risks and propose mitigations.

Context:
{json.dumps(summary)}

Respond with JSON only:
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
""".strip()

    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=800,
        )
        content = resp.choices[0].message.content or "{}"
        text = "".join(part.get("text", "") for part in content if isinstance(part, dict)) if isinstance(content, list) else str(content)
        data = json.loads(text)
        new_risks = data.get("risks") or []
    except Exception:
        if not tasks and not pull_requests:
            return existing_risks
        new_risks = [
            {
                "title": "Potential delivery risks",
                "description": "There may be blocked or delayed work based on recent GitHub activity. Review open tasks and pull requests.",
                "severity": "medium",
                "suggested_action": "Review blocked or long-running tasks and reassign or unblock them.",
            }
        ]

    now_iso = _utc_now_iso()
    merged: Dict[str, Dict[str, Any]] = {}
    for risk in new_risks:
        normalized = _normalize_risk(risk, now_iso)
        merged[_risk_key(normalized)] = normalized

    return list(merged.values())


def risk_node(state: Dict[str, Any]) -> Dict[str, Any]:
    blockers = list(state.get("blockers") or [])
    notifications = list(state.get("notifications") or [])
    existing_risks = list(state.get("risks") or [])
    activity_log = list(state.get("activity_log") or [])
    github_events = list(state.get("github_events") or [])
    workspace_members = list(state.get("team") or [])
    commits = [event for event in github_events if event.get("type") == "commit"]
    pull_requests = [event for event in github_events if event.get("type") == "pull_request"]

    candidate_risks = analyze_workspace_risks(
        {
            "tasks": state.get("tasks") or [],
            "team": state.get("team") or [],
            "members": state.get("team") or [],
            "risks": existing_risks,
        },
        commits,
        pull_requests,
    )

    now_iso = _utc_now_iso()
    risks_by_id: Dict[str, Dict[str, Any]] = {}
    for risk in candidate_risks:
        normalized = _normalize_risk(risk, now_iso)
        risks_by_id[normalized["id"]] = normalized

    for blocker in blockers:
        message = blocker.get("message") or blocker.get("reason") or "Task blocker detected"
        severity = "high" if "error" in message.lower() or blocker.get("severity") == "high" else "medium"
        normalized = _normalize_risk(
            {
                "type": "blocker",
                "title": "Commit Issue",
                "description": message,
                "severity": severity,
                "suggested_action": "Fix commit or reassign task",
                "created_at": now_iso,
                "task_id": blocker.get("task_id"),
            },
            now_iso,
            default_type="blocker",
        )
        risks_by_id[normalized["id"]] = normalized

    risks = list(risks_by_id.values())
    risk_hash = _stable_hash(
        sorted(
            [
                {
                    "id": risk.get("id"),
                    "severity": risk.get("severity"),
                    "description": risk.get("description"),
                    "task_id": risk.get("task_id"),
                }
                for risk in risks
            ],
            key=lambda item: (str(item.get("id")), str(item.get("severity")), str(item.get("description"))),
        )
    )

    if risk_hash == state.get("last_risks_hash"):
        return {
            "risks": risks,
            "notifications": notifications,
            "last_risks_hash": risk_hash,
            "risks_changed": False,
        }

    existing_risk_ids = {str(risk.get("id") or "") for risk in existing_risks}
    recipient_ids = [str(member.get("user_id") or member.get("id") or "") for member in workspace_members]
    for risk in risks:
        if risk["id"] in existing_risk_ids:
            continue
        for recipient_id in [rid for rid in recipient_ids if rid]:
            notifications.append(
                create_notification(
                    recipient_id,
                    f"New {risk.get('severity', 'medium')} risk detected: {risk.get('title') or 'Risk identified'}",
                    "risk",
                    severity=risk.get("severity", "medium"),
                    workspace_id=state.get("workspace_id"),
                    risk_id=risk["id"],
                    event_id=_stable_hash({"type": "risk", "risk_id": risk["id"]}),
                )
            )

    activity_log = append_activity_once(
        activity_log,
        "RISK_UPDATED",
        "Risk agent updated project risks",
        entity_id=state.get("workspace_id") or "",
        metadata={"risk_hash": risk_hash},
    )

    return {
        "risks": risks,
        "notifications": trim_notifications(notifications),
        "activity_log": trim_activity_log(activity_log),
        "last_risks_hash": risk_hash,
        "risks_changed": True,
    }
