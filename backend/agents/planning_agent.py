from __future__ import annotations

import json
import re
import uuid
from collections import OrderedDict
from datetime import date, timedelta
from typing import Any, Dict, List, TypedDict

from groq import Groq

from ..config import settings
from ..services.planning_validation import (
    break_cycles_greedy,
    build_edges_from_dependencies,
    strip_invalid_dependencies,
    validate_planning_graph,
)
from ..services.task_estimation import compute_task_estimated_effort


class PlanningState(TypedDict, total=False):
    prd: Dict[str, Any]
    plan: Dict[str, Any]


def _get_client() -> Groq:
    api_key = settings.PLANNING_AGENT_KEY or settings.GROQ_PLANNING_API_KEY
    if not api_key:
        raise RuntimeError("PLANNING_AGENT_KEY or GROQ_PLANNING_API_KEY is not set")
    return Groq(api_key=api_key)


def _norm_title(title: str) -> str:
    return " ".join((title or "").lower().split())


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


def _normalize_priority(raw: Any) -> str:
    s = str(raw or "medium").strip().lower()
    if s in ("low", "medium", "high"):
        return s
    return "medium"


def _normalize_status(raw: Any) -> str:
    s = str(raw or "todo").strip().lower()
    if s in ("todo", "in_progress", "done"):
        return s
    return "todo"


def _sanitize_task_id(raw: str | None) -> str:
    base = re.sub(r"[^a-zA-Z0-9_\-]", "_", str(raw or "").strip())[:64]
    return base or f"t_{uuid.uuid4().hex[:10]}"


def _flatten_phases_from_plan(plan: Dict[str, Any]) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Returns (phase_blocks_for_roadmap, flat_tasks_from_phases).
    phase_blocks include legacy-compatible keys.
    """
    raw_phases = plan.get("phases")
    if not isinstance(raw_phases, list) or not raw_phases:
        return [], []

    phase_blocks: List[Dict[str, Any]] = []
    flat: List[Dict[str, Any]] = []

    for idx, ph in enumerate(raw_phases):
        if not isinstance(ph, dict):
            continue
        name = str(ph.get("name") or ph.get("title") or ph.get("phase") or f"Phase {idx + 1}")
        tasks = ph.get("tasks") or []
        if not isinstance(tasks, list):
            tasks = []
        normalized_tasks: List[Dict[str, Any]] = []
        for t in tasks:
            if isinstance(t, dict):
                t = dict(t)
                t["_phase_name"] = name
                normalized_tasks.append(t)
                flat.append(t)

        items = [str(x.get("title") or x) for x in normalized_tasks if isinstance(x, dict)]
        phase_blocks.append(
            {
                "phase": f"Phase {idx + 1}",
                "title": name,
                "name": name,
                "date_range": ph.get("date_range") or "",
                "items": items,
                "tasks": normalized_tasks,
            }
        )

    return phase_blocks, flat


def _merge_task_graph_from_plan(plan: Dict[str, Any]) -> Dict[str, Any] | None:
    tg = plan.get("task_graph")
    if not isinstance(tg, dict):
        return None
    nodes = tg.get("nodes") or []
    edges = tg.get("edges") or []
    if not isinstance(nodes, list):
        nodes = []
    if not isinstance(edges, list):
        edges = []
    return {"nodes": nodes, "edges": edges}


def _normalize_plan_output(
    prd: Dict[str, Any],
    plan: Dict[str, Any],
    members: List[Dict[str, Any]] | None = None,
    existing_tasks: List[Dict[str, Any]] | None = None,
    *,
    historical_title_norms: set[str] | None = None,
    historical_anchor_hours: float | None = None,
    history_meta: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Produce roadmap + flat tasks + task_graph (DAG).
    Maintains backward compatibility: `tasks` remains a flat list for Kanban/graph.
    """
    roadmap = plan.get("roadmap") or {}
    if not isinstance(roadmap, dict):
        roadmap = {}

    existing_titles = {_norm_title(t.get("title", "")) for t in (existing_tasks or []) if t.get("title")}
    blocked_titles = set(existing_titles)
    if historical_title_norms:
        blocked_titles |= {x for x in historical_title_norms if x}

    # Prefer new Phase 2 shape: top-level phases + task_graph
    phase_blocks, phased_tasks = _flatten_phases_from_plan(plan)
    flat_from_plan = plan.get("tasks") or []
    if not isinstance(flat_from_plan, list):
        flat_from_plan = []

    if phased_tasks:
        tasks_raw = phased_tasks
    else:
        tasks_raw = [dict(t) for t in flat_from_plan if isinstance(t, dict)]

    if not tasks_raw:
        features = prd.get("features") or prd.get("key_features") or []
        if not isinstance(features, list):
            features = []
        if not features:
            features = ["Core MVP"]
        tasks_raw = [
            {
                "title": f"Implement {feature}",
                "description": f"Design, implement, and test the '{feature}' feature.",
                "dependencies": [],
                "priority": "medium",
                "estimated_effort": 8.0,
            }
            for feature in features
        ]

    # Dedupe against existing workspace tasks + retrieved historical titles (RAG overlap)
    tasks_filtered: List[Dict[str, Any]] = []
    for t in tasks_raw:
        nt = _norm_title(str(t.get("title") or ""))
        if nt and nt in blocked_titles:
            continue
        tasks_filtered.append(t)

    if not tasks_filtered:
        tasks_filtered = tasks_raw

    phases = roadmap.get("phases") or []
    if not isinstance(phases, list) or not phases:
        if phase_blocks:
            phases = phase_blocks
        else:
            phases = _synthesize_phases(prd)

    roadmap["phases"] = phases

    if history_meta:
        roadmap["planning_retrieval"] = {
            "retrieved_count": history_meta.get("retrieved_count", 0),
            "anchor_median_hours": history_meta.get("anchor_median_hours"),
            "historical_titles_considered": len(historical_title_norms or []),
        }

    base_deadline = date.today()
    normalized_tasks: List[Dict[str, Any]] = []
    phase_names = [
        ph.get("name") or ph.get("title") or ph.get("phase") or f"Phase {i + 1}"
        for i, ph in enumerate(roadmap.get("phases") or [])
    ] or ["Phase 1"]

    used_ids: set[str] = set()

    def _unique_id(candidate: str) -> str:
        tid = _sanitize_task_id(candidate)
        base = tid
        n = 0
        while tid in used_ids:
            n += 1
            tid = f"{base[:48]}_{n}"
        used_ids.add(tid)
        return tid

    for idx, task in enumerate(tasks_filtered):
        normalized_task = dict(task)
        normalized_task["id"] = _unique_id(str(normalized_task.get("id") or f"t_{uuid.uuid4().hex[:10]}"))
        normalized_task["title"] = str(normalized_task.get("title") or f"Task {idx + 1}")
        normalized_task["description"] = str(normalized_task.get("description") or normalized_task["title"])
        normalized_task["assigned_to"] = str(normalized_task.get("assigned_to") or "")
        normalized_task["status"] = _normalize_status(normalized_task.get("status"))
        normalized_task["deadline"] = str(
            normalized_task.get("deadline") or (base_deadline + timedelta(days=(idx + 1) * 7)).isoformat()
        )
        pn = normalized_task.pop("_phase_name", None)
        normalized_task["phase"] = str(normalized_task.get("phase") or pn or phase_names[idx % len(phase_names)])
        normalized_task["priority"] = _normalize_priority(normalized_task.get("priority"))
        normalized_task["_llm_effort_raw"] = normalized_task.get("estimated_effort")
        if normalized_task.get("estimated_duration") is not None:
            normalized_task["estimated_duration"] = str(normalized_task["estimated_duration"])
        deps = normalized_task.get("dependencies")
        if not isinstance(deps, list):
            deps = []
        normalized_task["dependencies"] = [str(d) for d in deps if d is not None]

        assignee = _pick_assignee(normalized_task, members or [], idx)
        if assignee:
            assignee_id = str(assignee.get("user_id") or assignee.get("id") or "")
            normalized_task["assigned_to"] = assignee_id
            normalized_task["assigned_to_name"] = assignee.get("name")
            normalized_task["assigned_user_id"] = assignee_id

        normalized_tasks.append(normalized_task)

    id_set = {t["id"] for t in normalized_tasks}
    # Re-map dependency ids that reference titles instead of ids (best-effort)
    title_to_id = {_norm_title(t["title"]): t["id"] for t in normalized_tasks}
    for t in normalized_tasks:
        fixed: List[str] = []
        for dep in t.get("dependencies") or []:
            ds = str(dep)
            if ds in id_set:
                fixed.append(ds)
            elif _norm_title(ds) in title_to_id:
                fixed.append(title_to_id[_norm_title(ds)])
        t["dependencies"] = list(dict.fromkeys(fixed))

    strip_invalid_dependencies(normalized_tasks)
    removed = break_cycles_greedy(normalized_tasks)
    if removed:
        roadmap.setdefault("planning_warnings", []).append(f"Removed {removed} cyclic dependency edge(s) to form a DAG.")

    for t in normalized_tasks:
        raw_llm = t.pop("_llm_effort_raw", None)
        eff, src, pts = compute_task_estimated_effort(
            t,
            raw_llm_effort=raw_llm,
            historical_anchor_hours=historical_anchor_hours,
        )
        t["estimated_effort"] = eff
        t["estimation_source"] = src
        t["estimated_story_points"] = pts
        t["estimation_unit"] = "hours"

    edges = build_edges_from_dependencies(normalized_tasks)
    llm_graph = _merge_task_graph_from_plan(plan)
    if llm_graph and isinstance(llm_graph.get("edges"), list):
        llm_edges = []
        for e in llm_graph["edges"]:
            if not isinstance(e, dict):
                continue
            src, tgt = str(e.get("source", "")), str(e.get("target", ""))
            if src in id_set and tgt in id_set:
                llm_edges.append(
                    {
                        "source": src,
                        "target": tgt,
                        "type": str(e.get("type") or "depends_on"),
                    }
                )
        if len(llm_edges) >= len(edges):
            edges = llm_edges

    nodes = []
    for t in normalized_tasks:
        nodes.append(
            {
                "id": t["id"],
                "title": t["title"],
                "phase": t.get("phase"),
                "priority": t.get("priority"),
            }
        )

    task_graph = {"nodes": nodes, "edges": edges}

    errs, _ = validate_planning_graph(normalized_tasks, check_cycle=False)
    if errs:
        roadmap.setdefault("planning_validation_errors", []).extend(errs)

    # Rebuild phases from normalized tasks (single source of truth) + legacy `items`
    phase_order = OrderedDict()
    for t in normalized_tasks:
        pname = str(t.get("phase") or "General")
        phase_order.setdefault(pname, []).append(t)

    rebuilt: List[Dict[str, Any]] = []
    for i, (name, ptasks) in enumerate(phase_order.items()):
        rebuilt.append(
            {
                "phase": f"Phase {i + 1}",
                "title": name,
                "name": name,
                "date_range": "",
                "items": [pt["title"] for pt in ptasks],
                "tasks": ptasks,
            }
        )
    roadmap["phases"] = rebuilt

    out = {
        "roadmap": roadmap,
        "tasks": normalized_tasks,
        "task_graph": task_graph,
        "phases": roadmap.get("phases") or [],
    }
    return out


def run_planning_agent(
    prd: Dict[str, Any],
    members: List[Dict[str, Any]] | None = None,
    existing_tasks: List[Dict[str, Any]] | None = None,
    *,
    history_context: str | None = None,
    historical_anchor_hours: float | None = None,
    historical_title_norms: set[str] | None = None,
    history_meta: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """
    Phase 2 planning: structured phases, DAG task graph, estimations, dependency validation.

    `existing_tasks` optional: used to avoid duplicating work already tracked on the workspace.
    `history_context` optional: RAG-style block from other workspaces (see planning_history_retrieval).
    """
    client = _get_client()

    existing_summary = ""
    if existing_tasks:
        lines = [f"- {t.get('title') or t.get('id')}" for t in existing_tasks[:40]]
        existing_summary = "Existing tasks already in the workspace (do NOT duplicate these):\n" + "\n".join(lines)

    system_prompt = """
You are a senior engineering lead building an execution plan from a PRD.

Return STRICT JSON only with this shape:
{
  "phases": [
    {
      "name": "Phase name (e.g. Authentication)",
      "tasks": [
        {
          "id": "stable_snake_case_id",
          "title": "string",
          "description": "string",
          "dependencies": ["prerequisite_task_id"],
          "priority": "low" | "medium" | "high",
          "estimated_effort": 4,
          "estimated_duration": "optional string e.g. 3d",
          "status": "todo"
        }
      ]
    }
  ],
  "task_graph": {
    "nodes": [{"id": "string", "title": "string", "phase": "string", "priority": "medium"}],
    "edges": [{"source": "prerequisite_task_id", "target": "dependent_task_id", "type": "depends_on"}]
  }
}

Rules:
1. Phases: logical groupings (e.g. Foundation/Setup, Backend, Frontend, QA). Order phases so setup & backend/API work come before frontend and integration when dependencies require it.
2. Tasks: concrete engineering work items. Every task MUST list dependency task ids that refer to OTHER tasks in the same JSON (use stable ids you invent, e.g. t_auth_schema). Later tasks may depend on earlier ones.
3. DAG: dependencies MUST form a directed acyclic graph (no cycles). Prefer: infrastructure & schema before APIs before UI before E2E tests.
4. Estimation: estimated_effort is hours (number). Use 2–16h typical; be realistic from PRD scope.
5. IDs: assign unique string ids per task; reuse the same ids in dependencies, nodes, and edges. Edges: source must be prerequisite, target is dependent.
6. If existing workspace tasks are listed in the user message, do NOT recreate them; add only net-new work.
7. If historical retrieval from other projects is included, use it only to calibrate effort and avoid redundant scope — do NOT copy task titles verbatim; adapt to this PRD.
8. No prose outside JSON.
""".strip()

    user_parts = [json.dumps(prd, indent=2)]
    if existing_summary:
        user_parts.append(existing_summary)
    if history_context:
        user_parts.append(history_context)

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "\n\n".join(user_parts)},
        ],
        temperature=0.2,
        max_tokens=4000,
    )

    content = response.choices[0].message.content
    text = "".join(part.get("text", "") for part in content if isinstance(content, list)) if isinstance(content, list) else str(content)

    try:
        plan = json.loads(text)
    except json.JSONDecodeError:
        plan = {"phases": [], "task_graph": {"nodes": [], "edges": []}, "tasks": []}

    if not isinstance(plan, dict):
        plan = {"phases": [], "task_graph": {"nodes": [], "edges": []}, "tasks": []}

    # Bridge: allow roadmap.tasks legacy from model
    if not plan.get("phases") and plan.get("roadmap"):
        r = plan["roadmap"]
        if isinstance(r, dict) and r.get("phases"):
            plan["phases"] = r["phases"]

    return _normalize_plan_output(
        prd,
        plan,
        members,
        existing_tasks=existing_tasks,
        historical_title_norms=historical_title_norms,
        historical_anchor_hours=historical_anchor_hours,
        history_meta=history_meta,
    )
