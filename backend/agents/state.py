from __future__ import annotations

from typing import Any, Dict, List, TypedDict


class ProjectState(TypedDict, total=False):
    workspace_id: str
    prd: str
    team: List[Dict[str, Any]]

    roadmap: Dict[str, Any]
    tasks: List[Dict[str, Any]]

    github_events: List[Dict[str, Any]]
    kanban: Dict[str, str]

    risks: List[Dict[str, Any]]
    notifications: List[Dict[str, Any]]

    project_complete: bool

    blockers: List[Dict[str, Any]]
    github_repo: Dict[str, Any]
    activity_log: List[Dict[str, Any]]
    processed_event_ids: List[str]
    last_monitoring_hash: str | None
    last_risks_hash: str | None
    last_replan_hash: str | None
    monitoring_changed: bool
    risks_changed: bool
    replan_changed: bool
