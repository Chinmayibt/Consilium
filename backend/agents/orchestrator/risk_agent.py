"""Risk agent: analyze blockers and delays, suggest mitigation via LLM."""
from __future__ import annotations

import json
from typing import Any, Dict, List

from groq import Groq

from ...config import settings  # agents/orchestrator -> agents -> backend root


def _get_client() -> Groq:
    api_key = getattr(settings, "GROQ_PLANNING_API_KEY", None) or getattr(settings, "GROQ_REQUIREMENTS_API_KEY", None)
    if not api_key:
        raise RuntimeError("No Groq API key configured")
    return Groq(api_key=api_key)


def run_risk_analysis(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyze blockers and missed deadlines; return severity, impact, recommended mitigation.
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

    try:
        client = _get_client()
        prompt = f"""Given these blocked items and tasks, analyze risk and suggest mitigation.
Blockers: {json.dumps(blockers[:10])}
Blocked tasks (summary): {json.dumps([{"id": t.get("id"), "title": t.get("title")} for t in blocked_tasks[:10]])}

Respond with JSON only:
{{ "risks": [ {{ "severity": "low|medium|high", "impact": "string", "mitigation": "string" }} ] }}"""

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
            new_risks = [{"severity": "medium", "impact": "Blocked tasks detected", "mitigation": "Review blockers and reassign or unblock."}]

        risks.extend(new_risks)
        updates["risks"] = risks
        for r in new_risks:
            notifications.append({
                "type": "risk",
                "message": f"Risk: {r.get('impact', '')} — {r.get('mitigation', '')}",
                "severity": r.get("severity", "medium"),
            })
        updates["notifications"] = notifications
    except Exception:
        notifications.append({"type": "risk", "message": "Blocked tasks detected. Review and reassign or unblock.", "severity": "medium"})
        updates["notifications"] = notifications

    return updates
