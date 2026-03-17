from typing import Any, Dict, List

# Shared Kanban statuses (Backlog, Todo, In Progress, Review, Blocked, Done)
KANBAN_STATUSES: tuple[str, ...] = (
    "backlog",
    "todo",
    "in_progress",
    "review",
    "blocked",
    "done",
)


def build_kanban(tasks: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Group tasks by status into Kanban columns.

    This is the single source of truth used by both the HTTP API
    and the LangGraph orchestrator.
    """
    columns: Dict[str, List[Dict[str, Any]]] = {status: [] for status in KANBAN_STATUSES}
    for task in tasks:
        status = (task.get("status") or "todo").lower()
        if status in columns:
            columns[status].append(task)
        else:
            columns["todo"].append(task)
    return columns

