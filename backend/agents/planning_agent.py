from __future__ import annotations

from typing import Any, Dict, List, TypedDict

from groq import Groq

from ..config import settings


class PlanningState(TypedDict, total=False):
    prd: Dict[str, Any]
    plan: Dict[str, Any]


def _get_client() -> Groq:
    api_key = settings.GROQ_PLANNING_API_KEY
    if not api_key:
        raise RuntimeError("GROQ_PLANNING_API_KEY is not set")
    return Groq(api_key=api_key)


def run_planning_agent(prd: Dict[str, Any], members: List[Dict[str, Any]] | None = None) -> Dict[str, Any]:
    """
    Planning agent that turns a PRD into roadmap phases and tasks.
    """
    client = _get_client()

    system_prompt = """
You are a senior product manager responsible for creating a realistic software development roadmap from a Product Requirements Document (PRD).

Your roadmap must:
- Break the project into logical development phases
- Respect technical dependencies
- Start with infrastructure and core systems
- Progress toward advanced features
- End with scaling, integrations, and optimization

You MUST respond with STRICT JSON only (no prose), with this exact top-level shape:
{
  "roadmap": {
    "phases": [
      {
        "phase": "Phase 1",
        "title": "Foundation & Setup",
        "date_range": "Week 1 – Week 2",
        "items": [
          "Project architecture setup",
          "Database schema design",
          "Authentication and authorization",
          "CI/CD pipeline configuration",
          "Core backend services"
        ]
      }
    ]
  },
  "tasks": [
    {
      "title": "Implement authentication and authorization",
      "description": "Design and implement secure auth flows across backend and frontend.",
      "status": "todo"
    }
  ]
}

Detailed instructions:
- Read and understand the PRD JSON.
- Extract product capabilities, subsystems, and major deliverables.
- Organize work into 4–6 phases:
  - Phase 1 – Foundation (architecture, database, auth, CI/CD, core services)
  - Phase 2 – Core Product Features
  - Phase 3 – Integrations & Automation
  - Phase 4 – Analytics / Intelligence
  - Phase 5 – Scaling & Optimization (only if scope requires it)
- Respect dependencies: foundational work must appear in earlier phases; advanced / intelligent features and large-scale optimizations must appear in later phases.

For EACH phase:
- phase: string like "Phase 1", "Phase 2", etc.
- title: descriptive phase name.
- date_range: realistic estimated timeline label (e.g. "Week 1 – Week 2" or "Month 1").
- items: a list (4–8 entries) of high-level deliverables.

Deliverables (items) MUST:
- Describe capabilities or outcomes, NOT low-level implementation tasks.
- Avoid generic phrases like "implement system" or "do development".
- Be specific enough to understand what value is delivered in that phase.

Tasks:
- Use the tasks list for more concrete engineering tasks that can be assigned.
- You MAY leave tasks empty if not required, but the roadmap phases MUST always be fully populated.

Constraints:
- 4–6 phases total.
- Each phase MUST contain 4–8 items.
- Do NOT use internal IDs like "T-1" or "P-1" anywhere.
- Respond with STRICT JSON ONLY, no surrounding prose.
"""

    import json

    user_prompt = json.dumps(prd, indent=2)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    print("Running planning agent with planning API key")

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=messages,
        temperature=0.2,
        max_tokens=2000,
    )

    content = response.choices[0].message.content
    if isinstance(content, list):
        text = "".join(
            part.get("text", "") for part in content if isinstance(part, dict)
        )
    else:
        text = str(content)

    try:
        plan = json.loads(text)
    except json.JSONDecodeError:
        plan = {"roadmap": {"phases": []}, "tasks": []}

    if not isinstance(plan, dict):
        plan = {"roadmap": {"phases": []}, "tasks": []}

    roadmap = plan.get("roadmap") or {}
    if not isinstance(roadmap, dict):
        roadmap = {}

    phases = roadmap.get("phases") or []
    if not isinstance(phases, list):
        phases = []

    # If no phases were produced, synthesize a richer multi-phase roadmap from the PRD
    if not phases:
        features = prd.get("features") or prd.get("key_features") or []
        if not isinstance(features, list):
            features = []
        if not features:
            features = ["Core MVP capability"]

        # Heuristically split features into up to 4 buckets for phases
        buckets: List[List[str]] = [[], [], [], []]
        for idx, feat in enumerate(features):
            buckets[idx % len(buckets)].append(str(feat))

        phase_templates = [
            ("Phase 1", "Foundation & Setup", "Week 1 – Week 2"),
            ("Phase 2", "Core Product Features", "Week 3 – Week 6"),
            ("Phase 3", "Integrations & Automation", "Week 7 – Week 9"),
            ("Phase 4", "Analytics & Intelligence", "Week 10 – Week 12"),
        ]

        synthesized_phases: List[Dict[str, Any]] = []
        for (phase_label, title, date_range), items in zip(phase_templates, buckets):
            if not items:
                continue
            # Enforce 4–8 items by truncating or repeating if very small
            if len(items) > 8:
                items = items[:8]
            synthesized_phases.append(
                {
                    "phase": phase_label,
                    "title": title,
                    "date_range": date_range,
                    "items": items,
                }
            )

        phases = synthesized_phases or [
            {
                "phase": "Phase 1",
                "title": "Foundation & Setup",
                "date_range": "Week 1 – Week 2",
                "items": [str(f) for f in features[:8]],
            }
        ]

    roadmap["phases"] = phases

    # Ensure tasks is always a list of dicts
    tasks = plan.get("tasks") or []
    if not isinstance(tasks, list):
        tasks = []

    # If tasks are empty, synthesize basic implementation tasks from features
    if not tasks:
        synthesized_tasks = []
        features = prd.get("features") or prd.get("key_features") or []
        if not isinstance(features, list):
            features = []
        if not features:
            features = ["Core MVP"]

        for feature in features:
            synthesized_tasks.append(
                {
                    "title": f"Implement {feature}",
                    "description": f"Design, implement, and test the '{feature}' feature.",
                    "status": "todo",
                }
            )
        tasks = synthesized_tasks

    # Ensure each task has id and optional deadline; round-robin assignment
    import uuid
    assigned_tasks: List[Dict[str, Any]] = []
    m_count = len(members) or 1
    for idx, task in enumerate(tasks):
        t = dict(task)
        t.setdefault("id", str(uuid.uuid4())[:8])
        t.setdefault("deadline", None)
        t.setdefault("status", "todo")
        if members:
            member = members[idx % m_count]
            t["assigned_to"] = str(member.get("user_id"))
            t["assigned_to_name"] = member.get("name")
        assigned_tasks.append(t)
    tasks = assigned_tasks

    result = {"roadmap": roadmap, "tasks": tasks}

    print("Generated roadmap:", result)

    return result

