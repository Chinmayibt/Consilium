# Consilium

Consilium is an AI-assisted project management platform with a FastAPI backend and a React frontend. It helps a team move from product requirements to roadmap, Kanban execution, GitHub monitoring, risk detection, replanning, and in-app notifications.

## Current Status

The project currently includes:

- Authentication with signup, login, JWT access tokens, and refresh tokens
- Workspace creation and invite-code based team joining
- AI-generated PRDs from structured product input
- AI-generated roadmap phases and assignable engineering tasks
- Workspace Kanban board with drag-and-drop task status updates
- GitHub OAuth, repository linking, webhook ingestion, and activity sync
- Background monitoring loop that feeds a LangGraph-based project workflow
- Risk detection, replanning, and notification generation
- Workspace activity feed, risk dashboard, monitoring page, analytics page, and project insight bot

## Tech Stack

- Backend: FastAPI, Motor/PyMongo, LangGraph, Groq, Gemini API, PyGithub, ReportLab
- Frontend: React, TypeScript, Vite, React Query, Zustand, Tailwind, shadcn/ui
- Database: MongoDB

## Repository Structure

```text
.
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── auth.py
│   ├── dependencies.py
│   ├── requirements.txt
│   ├── agents/
│   ├── models/
│   ├── routers/
│   └── services/
└── frontend/
    ├── package.json
    ├── src/
    └── public/
```

## Backend Overview

The backend starts in `backend/main.py` and wires together:

- route modules under `backend/routers`
- shared services under `backend/services`
- AI and workflow logic under `backend/agents`
- MongoDB access through `backend/database.py`

Key backend areas:

- `backend/routers/auth.py`: signup, login, refresh
- `backend/routers/workspaces.py`: workspace CRUD and team membership
- `backend/routers/requirements.py`: PRD, roadmap, Kanban, activity, risks, workspace notifications
- `backend/routers/github.py`: GitHub OAuth, repo linking, webhook processing, activity sync
- `backend/routers/ai_insights.py`: workspace Q&A using Gemini
- `backend/routers/notifications.py`: global notification aggregation across workspaces
- `backend/agents/requirements_agent.py`: PRD generation
- `backend/agents/planning_agent.py`: roadmap and task generation
- `backend/agents/graph.py`: LangGraph workflow and background monitoring loop
- `backend/agents/monitoring_agent.py`: GitHub event normalization and task/activity updates
- `backend/agents/risk_agent.py`: project risk detection
- `backend/agents/replanning_agent.py`: task reassignment and schedule adjustment
- `backend/agents/notification_agent.py`: notification generation

## Frontend Overview

The frontend is a Vite React app. Routes are defined in `frontend/src/App.tsx`.

Main user flows:

- `/login`, `/signup`
- `/workspaces`
- `/dashboard/:workspaceId/requirements`
- `/dashboard/:workspaceId/prd`
- `/dashboard/:workspaceId/roadmap`
- `/dashboard/:workspaceId/kanban`
- `/dashboard/:workspaceId/integrations`
- `/dashboard/:workspaceId/activity`
- `/dashboard/:workspaceId/monitoring`
- `/dashboard/:workspaceId/risks`

API calls are centralized in:

- `frontend/src/api/client.ts`
- `frontend/src/api/auth.ts`
- `frontend/src/api/workspaces.ts`

## End-to-End Flow

1. A manager creates a workspace and shares the invite code.
2. Product details are submitted from the Requirements page.
3. The requirements agent generates a draft PRD.
4. Finalizing the PRD triggers roadmap and task generation.
5. Tasks are shown in the roadmap and Kanban views.
6. GitHub can be connected to a workspace for repo activity and webhook updates.
7. The background monitoring loop and project graph analyze activity, detect blockers and risks, and create notifications or replanning updates.

## Environment Variables

Create `backend/.env` with the variables used by `backend/config.py`.

Required or commonly used variables:

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `GROQ_REQUIREMENTS_API_KEY`
- `GROQ_PLANNING_API_KEY`
- `PLANNING_AGENT_KEY`
- `MONITORING_AGENT_KEY`
- `RISK_AGENT_KEY`
- `REPLANNING_AGENT_KEY`
- `GEMINI_API_KEY`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_REDIRECT_URI`
- `GITHUB_WEBHOOK_SECRET`
- `FRONTEND_URL`

Notes:

- The app can run without all optional integrations, but auth and Mongo must be configured.
- GitHub OAuth and webhooks need the GitHub variables set.
- AI insight and planning quality depend on the Groq and Gemini keys being present.

## Local Development

### Backend

From the repository root:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --app-dir ..
```

The API default is `http://localhost:8000`.

### Frontend

From the repository root:

```powershell
cd frontend
npm install
npm run dev
```

The frontend default is `http://localhost:5173`.

If needed, set:

```env
VITE_API_URL=http://localhost:8000
```

## Background Processing

On backend startup:

- workspace signal data is reset once via `reset_workspace_signal_data_once()`
- a background monitoring loop starts
- the loop periodically fetches GitHub activity for connected workspaces
- the LangGraph workflow updates tasks, blockers, risks, notifications, and activity logs

## API Highlights

Important routes currently available:

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /workspaces`
- `POST /workspaces`
- `POST /workspaces/join`
- `POST /api/workspaces/{workspace_id}/generate-prd`
- `GET /api/workspaces/{workspace_id}/prd`
- `PUT /api/workspaces/{workspace_id}/prd`
- `POST /api/workspaces/{workspace_id}/finalize-prd`
- `GET /api/workspaces/{workspace_id}/roadmap`
- `GET /api/workspaces/{workspace_id}/kanban`
- `PATCH /api/workspaces/{workspace_id}/tasks/{task_id}`
- `GET /api/workspaces/{workspace_id}/activity`
- `GET /api/workspaces/{workspace_id}/risks`
- `GET /api/workspaces/{workspace_id}/notifications`
- `GET /api/notifications`
- `GET /api/github/connect`
- `POST /api/github/webhook`
- `POST /api/ai/project-insights`

## Testing and Tooling

Frontend scripts from `frontend/package.json`:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`

Backend currently uses `uvicorn` for local development and relies on the installed Python dependencies from `backend/requirements.txt`.

## Notes

- The current implementation stores most project execution state on workspace documents in MongoDB.
- Notifications and activity logs are trimmed to bounded lengths by `backend/services/notification_service.py`.
- The repo previously had older orchestrator-specific modules; the current active workflow is centered around `backend/agents/graph.py`.
