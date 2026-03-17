from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio

from .routers import auth as auth_router
from .routers import workspaces as workspaces_router
from .routers import projects as projects_router
from .routers import tasks as tasks_router
from .routers import requirements as requirements_router
from .routers import github as github_router
from .routers import ai_insights as ai_insights_router
from .routers import notifications as notifications_router
from .agents.graph import monitoring_loop
from .services.notification_service import reset_workspace_signal_data_once

app = FastAPI(title="ProjectAI Backend")

origins = ["http://localhost:5173", "http://localhost:8080", "http://127.0.0.1:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def start_monitoring_loop() -> None:
    await reset_workspace_signal_data_once()
    # Fire-and-forget background monitoring loop
    asyncio.create_task(monitoring_loop())


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(auth_router.router)
app.include_router(workspaces_router.router)
app.include_router(projects_router.router)
app.include_router(tasks_router.router)
app.include_router(requirements_router.router)
app.include_router(github_router.router)
app.include_router(ai_insights_router.router)
app.include_router(notifications_router.router)

