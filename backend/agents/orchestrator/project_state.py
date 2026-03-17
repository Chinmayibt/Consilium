"""Shared state for the project LangGraph orchestrator."""
from __future__ import annotations

from typing import Any, Dict, List, TypedDict


class ProjectState(TypedDict, total=False):
    workspace_id: str
    prd: Dict[str, Any]
    roadmap: Dict[str, Any]
    tasks: List[Dict[str, Any]]
    team_members: List[Dict[str, Any]]
    kanban: Dict[str, List[Dict[str, Any]]]
    github_repo: Dict[str, Any]
    commits: List[Dict[str, Any]]
    blockers: List[Dict[str, Any]]
    risks: List[Dict[str, Any]]
    notifications: List[Dict[str, Any]]
    activity_log: List[Dict[str, Any]]
    project_complete: bool
