# Codebase Analysis — AI Project Management System

## STEP 1 — Existing Features

| Component | Status | Location |
|-----------|--------|----------|
| **PRD generation** | ✅ Implemented | `backend/agents/requirements_agent.py`, `POST /api/workspaces/{id}/generate-prd` |
| **Planning agent** | ✅ Implemented | `backend/agents/planning_agent.py` — `run_planning_agent(prd, members)` returns `{ roadmap, tasks }` |
| **Roadmap storage** | ✅ Implemented | `workspace.roadmap` (phases) in MongoDB `workspaces` collection |
| **Tasks storage** | ✅ Implemented | `workspace.tasks` saved in `POST /api/workspaces/{id}/finalize-prd` |
| **Kanban** | ⚠️ UI only, mock data | `frontend/src/pages/KanbanPage.tsx` — hardcoded columns/tasks; no API for workspace tasks/kanban |
| **GitHub integration** | ✅ Implemented | `backend/routers/github.py` — OAuth, repos, sync-issues, activity, webhook |
| **Notification system** | ❌ Missing | No in-app or email notifications; Activity page uses mock events |
| **Task assignment** | ✅ In planning agent | Round-robin in `planning_agent.py`; separate `backend/routers/tasks.py` uses `tasks` collection (project-scoped) |

### MongoDB Collections Used

- **workspaces** — workspace doc includes `prd`, `prd_status`, `roadmap`, `tasks`, `plan_generated`, `github`, `members`, `owner_id`, etc.
- **users** — auth and user profile; `workspaces` array of workspace ids
- **projects** — optional project entity (workspace_id, name, phases, etc.)
- **tasks** — standalone task documents with `project_id`, `workspace_id`, status, assignee, github_issue, github_pr (used by tasks router; distinct from `workspace.tasks`)

---

## STEP 2 — Missing Components

| Component | Description |
|-----------|-------------|
| **monitoring_agent** | Monitor GitHub (commits, PRs, CI), update Kanban/task status (e.g. PR merged → task done) |
| **risk_agent** | Analyze blockers, missed deadlines, CI failures; severity and mitigation via LLM |
| **replanning_agent** | Reassign blocked tasks, update deadlines, reorder roadmap when needed |
| **notification_agent** | In-app (and optional email) for task assigned, completed, blocker, reassigned, project complete |
| **project_orchestrator** | LangGraph workflow: planning_node → monitoring_node → conditional risk/replan/notification |
| **GitHub webhook monitoring** | Partially present (`POST /api/github/webhook`); can drive monitoring agent on push/PR/issues |

---

## STEP 3 — Reuse of Existing Agents

- **requirements_agent.py** — Not modified; used by `generate-prd` only.
- **planning_agent.py** — Not rewritten; used as the first node (or data source) in the orchestrator graph; output already `{ roadmap, tasks }`.

---

## STEP 4–12 — Implementation Summary

- **Orchestrator** under `backend/agents/orchestrator/`: shared state, monitoring, risk, replanning, notification agents, and LangGraph workflow.
- **finalize-prd** builds `workspace.kanban` from `workspace.tasks`, then triggers `start_project_graph(workspace_id)`.
- **GET /roadmap** response includes `workspace.tasks` so the roadmap page shows tasks.
- **GET /kanban** and **GET /notifications** (or activity) added for Kanban and Activity pages.
- Frontend mock data removed; pages use API data only.
