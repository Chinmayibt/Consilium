# Multi-Agent Project Management Platform – Architecture

## System flow

1. **PRD generated** → Stored on workspace; user finalizes PRD.
2. **Planning Agent** → Creates roadmap (phases), tasks with phase/priority/deadline/dependencies, assigns by role (backend/frontend/QA).
3. **Tasks** → Populate Kanban (Backlog, To Do, In Progress, Review, Blocked, Done).
4. **Integrations** → User connects GitHub (repo + token); stored on workspace.
5. **Monitoring Agent** (background loop, ~30s) → Fetches commits/PRs; updates task status (commit refs task → in progress, PR merged → done, PR closed unmerged → blocked); writes activity log; runs risk analysis.
6. **Risk Agent** → Analyzes blockers/delays; creates risk entries (id, task_id, description, severity, probability); notifies (blocker/risk messages).
7. **Replanning Agent** → When blockers/risks exist: reassigns blocked tasks, can adjust priorities/deadlines; appends notifications.
8. **Notification Agent** → Appends in-app notifications (task assigned, blocker, risk, project completed).
9. **Loop** → Monitoring → Risk → Replanning → Kanban/notifications updated; repeats until all tasks done.
10. **Project completion** → When all tasks done: project_completed notification + activity log entry; all members see completion.

## Components

| Component        | Location                          | Role |
|-----------------|-----------------------------------|------|
| PRD             | `workspace.prd`                   | Stored on workspace; finalized via API. |
| Planning Agent  | `backend/agents/planning_agent.py`| PRD → roadmap + tasks; phase, priority, dependencies; role-based assignment. |
| Kanban          | `backend/routers/requirements.py` | Columns: backlog, todo, in_progress, review, blocked, done. PATCH task status. |
| GitHub          | `workspace.github`                | access_token, repo_owner, repo_name. |
| Monitoring (fetch) | `backend/agents/monitoring_agent.py` | fetch_github_activity; apply_github_activity_to_tasks. |
| Monitoring (loop)  | `backend/agents/monitoring_loop.py` | Periodic: fetch → update tasks → risk → persist → start_project_graph. |
| Orchestrator    | `backend/agents/orchestrator/project_orchestrator.py` | LangGraph: planning → monitoring → risk → replanning → notification. |
| Risk Agent      | `backend/agents/risk_agent.py` (workspace-level) + `orchestrator/risk_agent.py` (blocker/LLM) | Risks with task_id, severity (low/medium/high/critical), probability. |
| Replanning Agent| `backend/agents/orchestrator/replanning_agent.py`     | Reassign blocked tasks; task_assigned notifications. |
| Activity log    | `workspace.activity_log`          | action_type, description, user_id, entity_id, timestamp. |
| Notifications   | `workspace.notifications`         | type, message, read, created_at. |

## Task schema (from Planning Agent)

- id, title, description, phase, assigned_to / assigned_user_id, assigned_to_name, status, priority, deadline, dependencies

## Risk schema

- id, task_id, description, severity (low|medium|high|critical), probability, created_at

## Activity events

- PLAN_GENERATED, TASK_CREATED, TASK_ASSIGNED, COMMIT_DETECTED, BLOCKER_DETECTED, RISK_UPDATED, REPLANNING_TRIGGERED, MONITORING_TICK, PROJECT_COMPLETED

## Notification triggers

- Task assigned (replanning), blocker detected, risk identified, replanning (schedule updated), project completed.
