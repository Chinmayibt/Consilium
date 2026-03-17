"""Risk agent: analyze blockers and delays, suggest mitigation via LLM."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from groq import Groq

from ...config import settings  # agents/orchestrator -> agents -> backend root


def _get_client() -> Groq:
    api_key = getattr(settings, "GROQ_PLANNING_API_KEY", None) or getattr(settings, "GROQ_REQUIREMENTS_API_KEY", None)
    if not api_key:
        raise RuntimeError("No Groq API key configured")
    return Groq(api_key=api_key)


def _risk_dedup_key(task_id: str | None, description: str) -> str:
    """Unique key for risk: same task_id + same description = same risk (update, do not insert)."""
    desc_norm = (description or "").strip().lower()[:200]
    return f"{task_id or ''}|{desc_norm}"


def run_risk_analysis(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze blockers and missed deadlines; return severity, impact, recommended mitigation.
    Merges by (task_id, description): if risk exists, UPDATE (severity, probability, last_detected, occurrence_count); else INSERT.
    """
    updates: Dict[str, Any] = {}
    blockers = list(state.get("blockers") or [])
    tasks = state.get("tasks") or []
    risks = list(state.get("risks") or [])
    notifications = list(state.get("notifications") or [])

    if not blockers and not any((t.get("status") == "blocked") for t in tasks):
        return updates

    blocked_tasks = [t for t in tasks if (t.get("status") or "").lower() == "blocked"]
    if not blocked_tasks and not blockers:
        return updates

    now_iso = datetime.now(timezone.utc).isoformat()

    # Build map of existing risks by (task_id, description) for update-not-insert
    existing_by_key: Dict[str, Dict[str, Any]] = {}
    for r in risks:
        tid = r.get("task_id")
        if tid is not None:
            tid = str(tid)
        key = _risk_dedup_key(tid, r.get("description") or "")
        existing_by_key[key] = dict(r)

    try:
        client = _get_client()
        prompt = f"""Given these blocked items and tasks, analyze risk and suggest mitigation.
Blockers: {json.dumps(blockers[:10])}
Blocked tasks (summary): {json.dumps([{"id": t.get("id"), "title": t.get("title")} for t in blocked_tasks[:10]])}

Respond with JSON only:
{{ "risks": [ {{ "severity": "low|medium|high|critical", "impact": "string", "mitigation": "string", "probability": "low|medium|high" }} ] }}"""

        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=800,
        )
        text = resp.choices[0].message.content or "{}"
        try:
            data = json.loads(text)
            new_risks = data.get("risks") or []
        except json.JSONDecodeError:
            new_risks = [{"severity": "medium", "impact": "Blocked tasks detected", "mitigation": "Review blockers and reassign or unblock.", "probability": "medium"}]

        for i, r in enumerate(new_risks):
            task_id = blocked_tasks[i].get("id") if i < len(blocked_tasks) else None
            task_id_str = str(task_id) if task_id else None
            severity = (r.get("severity") or "medium").lower()
            if severity not in ("low", "medium", "high", "critical"):
                severity = "medium"
            description = r.get("impact") or r.get("mitigation") or "Risk identified"
            key = _risk_dedup_key(task_id_str, description)

            if key in existing_by_key:
                # Update existing risk: severity, probability, last_detected, occurrence_count
                existing = existing_by_key[key]
                existing["severity"] = severity
                existing["probability"] = (r.get("probability") or "medium").lower()
                existing["last_detected"] = now_iso
                existing["occurrence_count"] = (existing.get("occurrence_count") or 1) + 1
                existing_by_key[key] = existing
                # Do not add duplicate notification
            else:
                risk_entry = {
                    "id": str(uuid.uuid4())[:12],
                    "task_id": task_id_str,
                    "description": description,
                    "severity": severity,
                    "probability": (r.get("probability") or "medium").lower(),
                    "created_at": now_iso,
                    "last_detected": now_iso,
                    "occurrence_count": 1,
                }
                existing_by_key[key] = risk_entry
                notifications.append({
                    "type": "risk",
                    "message": f"⚠ Risk: {r.get('impact', '')} — {r.get('mitigation', '')}",
                    "severity": severity,
                    "read": False,
                    "created_at": now_iso,
                })

        updates["risks"] = list(existing_by_key.values())
        updates["notifications"] = notifications
    except Exception:
        task_id = blocked_tasks[0].get("id") if blocked_tasks else None
        task_id_str = str(task_id) if task_id else None
        description = "Blocked tasks detected"
        key = _risk_dedup_key(task_id_str, description)
        if key not in existing_by_key:
            existing_by_key[key] = {
                "id": str(uuid.uuid4())[:12],
                "task_id": task_id_str,
                "description": description,
                "severity": "medium",
                "probability": "medium",
                "created_at": now_iso,
                "last_detected": now_iso,
                "occurrence_count": 1,
            }
            notifications.append({
                "type": "risk",
                "message": "⚠ Blocker detected. Review and reassign or unblock.",
                "severity": "medium",
                "read": False,
                "created_at": now_iso,
            })
        updates["risks"] = list(existing_by_key.values())
        updates["notifications"] = notifications

    return updates
