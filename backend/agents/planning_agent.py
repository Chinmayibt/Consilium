from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any, Dict, List, TypedDict
import uuid

from groq import Groq

from ..config import settings


class PlanningState(TypedDict, total=False):
    prd: Dict[str, Any]
    plan: Dict[str, Any]


def _get_client() -> Groq:
    api_key = settings.PLANNING_AGENT_KEY or settings.GROQ_PLANNING_API_KEY
    if not api_key:
        raise RuntimeError("PLANNING_AGENT_KEY or GROQ_PLANNING_API_KEY is not set")
    return Groq(api_key=api_key)


def _pick_assignee(task: Dict[str, Any], members: List[Dict[str, Any]], idx: int) -> Dict[str, Any] | None:
    if not members:
        return None

    title = (task.get("title") or "").lower()
    for member in members:
        skills = member.get("skills") or []
        role = (member.get("role") or "").lower()

        if "backend" in title or "api" in title or "server" in title:
            if any("backend" in str(skill).lower() or "api" in str(skill).lower() for skill in skills) or role == "manager":
                return member
        if "frontend" in title or "ui" in title or "react" in title:
            if any("frontend" in str(skill).lower() or "ui" in str(skill).lower() or "react" in str(skill).lower() for skill in skills) or role == "manager":
                return member
        if "test" in title or "qa" in title:
            if any("test" in str(skill).lower() or "qa" in str(skill).lower() for skill in skills) or role == "manager":
                return member

    return members[idx % len(members)]


def _synthesize_phases(prd: Dict[str, Any]) -> List[Dict[str, Any]]:
    features = prd.get("features") or prd.get("key_features") or []
    if not isinstance(features, list):
        features = []
    if not features:
        features = ["Core MVP capability"]

    buckets: List[List[str]] = [[], [], [], []]
    for idx, feat in enumerate(features):
        buckets[idx % len(buckets)].append(str(feat))

    phase_templates = [
        ("Phase 1", "Foundation & Setup", "Week 1 - Week 2"),
        ("Phase 2", "Core Product Features", "Week 3 - Week 6"),
        ("Phase 3", "Integrations & Automation", "Week 7 - Week 9"),
        ("Phase 4", "Analytics & Intelligence", "Week 10 - Week 12"),
    ]

    phases: List[Dict[str, Any]] = []
    for (phase, title, date_range), items in zip(phase_templates, buckets):
        if items:
            phases.append(
                {
                    "phase": phase,
                    "title": title,
                    "date_range": date_range,
                    "items": items[:8],
                }
            )
    return phases or [
        {
            "phase": "Phase 1",
            "title": "Foundation & Setup",
            "date_range": "Week 1 - Week 2",
            "items": [str(item) for item in features[:8]],
        }
    ]


def _normalize_plan_output(
    prd: Dict[str, Any],
    plan: Dict[str, Any],
    members: List[Dict[str, Any]] | None = None,
) -> Dict[str, Any]:
    roadmap = plan.get("roadmap") or {}
    if not isinstance(roadmap, dict):
        roadmap = {}

    phases = roadmap.get("phases") or []
    if not isinstance(phases, list) or not phases:
        phases = _synthesize_phases(prd)
    roadmap["phases"] = phases

    tasks = plan.get("tasks") or []
    if not isinstance(tasks, list):
        tasks = []
    if not tasks:
        features = prd.get("features") or prd.get("key_features") or []
        if not isinstance(features, list):
            features = []
        if not features:
            features = ["Core MVP"]
        tasks = [
            {
                "title": f"Implement {feature}",
                "description": f"Design, implement, and test the '{feature}' feature.",
                "status": "todo",
            }
            for feature in features
        ]

    phase_names = [phase.get("phase") or phase.get("title") or f"Phase {idx + 1}" for idx, phase in enumerate(phases)] or ["Phase 1"]
    base_deadline = date.today()
    normalized_tasks: List[Dict[str, Any]] = []

    for idx, task in enumerate(tasks):
        normalized_task = dict(task)
        normalized_task["id"] = str(normalized_task.get("id") or uuid.uuid4().hex[:8])
        normalized_task["title"] = str(normalized_task.get("title") or f"Task {idx + 1}")
        normalized_task["description"] = str(normalized_task.get("description") or normalized_task["title"])
        normalized_task["assigned_to"] = str(normalized_task.get("assigned_to") or "")
        normalized_task["status"] = "todo"
        normalized_task["deadline"] = str(normalized_task.get("deadline") or (base_deadline + timedelta(days=(idx + 1) * 7)).isoformat())
        normalized_task["phase"] = normalized_task.get("phase") or phase_names[idx % len(phase_names)]
        normalized_task.setdefault("priority", "medium")
        normalized_task.setdefault("dependencies", [])

        assignee = _pick_assignee(normalized_task, members or [], idx)
        if assignee:
            assignee_id = str(assignee.get("user_id") or assignee.get("id") or "")
            normalized_task["assigned_to"] = assignee_id
            normalized_task["assigned_to_name"] = assignee.get("name")
            normalized_task["assigned_user_id"] = assignee_id

        normalized_tasks.append(normalized_task)

    return {"roadmap": roadmap, "tasks": normalized_tasks}


def run_planning_agent(prd: Dict[str, Any], members: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    client = _get_client()

    system_prompt = """
You are a senior product manager responsible for creating a realistic software development roadmap from a Product Requirements Document (PRD).

Return STRICT JSON only with this shape:
{
  "roadmap": {
    "phases": [
      {
        "phase": "Phase 1",
        "title": "Foundation & Setup",
        "date_range": "Week 1 - Week 2",
        "items": ["deliverable 1", "deliverable 2"]
      }
    ]
  },
  "tasks": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "assigned_to": "string",
      "status": "todo",
      "deadline": "YYYY-MM-DD"
    }
  ]
}

Rules:
- 4 to 6 roadmap phases when possible.
- Each phase should contain 4 to 8 high-level deliverables.
- Tasks must be concrete engineering tasks that can be assigned.
- Always use status "todo" for tasks.
- Do not add any prose outside the JSON.
""".strip()

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(prd, indent=2)},
        ],
        temperature=0.2,
        max_tokens=2000,
    )

    content = response.choices[0].message.content
    text = "".join(part.get("text", "") for part in content if isinstance(part, dict)) if isinstance(content, list) else str(content)

    try:
        plan = json.loads(text)
    except json.JSONDecodeError:
        plan = {"roadmap": {"phases": []}, "tasks": []}

    if not isinstance(plan, dict):
        plan = {"roadmap": {"phases": []}, "tasks": []}

    return _normalize_plan_output(prd, plan, members)
