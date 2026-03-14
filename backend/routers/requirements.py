from typing import Any, Dict, List
from io import BytesIO

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import PlainTextResponse, Response
from pydantic import BaseModel
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

from ..agents.requirements_agent import run_requirements_agent
from ..agents.planning_agent import run_planning_agent
from ..database import get_db
from ..dependencies import get_current_user


router = APIRouter(prefix="/api/workspaces", tags=["requirements"])


class GeneratePrdRequest(BaseModel):
    product_name: str
    product_description: str
    target_users: str
    key_features: str
    competitors: str | None = None
    constraints: str | None = None


class GeneratePrdResponse(BaseModel):
    prd: Dict[str, Any]


@router.post(
    "/{workspace_id}/generate-prd",
    response_model=GeneratePrdResponse,
    status_code=status.HTTP_200_OK,
)
async def generate_prd_for_workspace(
    workspace_id: str,
    payload: GeneratePrdRequest,
    current_user=Depends(get_current_user),
) -> GeneratePrdResponse:
    db = get_db()
    workspaces = db["workspaces"]

    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")

    workspace = await workspaces.find_one({"_id": oid})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # TODO: enforce that current_user is a member/owner of this workspace if desired

    prd = await _run_agent_async(payload)

    # Save PRD only; roadmap is generated when PRD is finalized
    await workspaces.update_one(
        {"_id": oid},
        {
            "$set": {"prd": prd, "prd_status": "draft"},
            "$unset": {"roadmap": "", "plan_generated": ""},
        },
    )

    return GeneratePrdResponse(prd=prd)


class SavePrdRequest(BaseModel):
    prd: Dict[str, Any]


class PrdResponse(BaseModel):
    prd: Dict[str, Any] | None
    prd_status: str = "draft"


@router.get(
    "/{workspace_id}/prd",
    response_model=PrdResponse,
    status_code=status.HTTP_200_OK,
)
async def get_workspace_prd(
    workspace_id: str,
    current_user=Depends(get_current_user),
) -> PrdResponse:
    db = get_db()
    workspaces = db["workspaces"]

    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")

    workspace = await workspaces.find_one({"_id": oid})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    return PrdResponse(
        prd=workspace.get("prd"),
        prd_status=workspace.get("prd_status", "draft"),
    )


@router.put(
    "/{workspace_id}/prd",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def save_workspace_prd(
    workspace_id: str,
    payload: SavePrdRequest,
    current_user=Depends(get_current_user),
) -> None:
    db = get_db()
    workspaces = db["workspaces"]

    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")

    workspace = await workspaces.find_one({"_id": oid})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    await workspaces.update_one(
        {"_id": oid},
        {"$set": {"prd": payload.prd, "prd_status": "draft"}},
    )

    return None


def _build_kanban(tasks: list) -> Dict[str, Any]:
    """Group tasks by status for kanban columns."""
    columns: Dict[str, list] = {
        "todo": [],
        "in_progress": [],
        "blocked": [],
        "done": [],
    }
    for t in tasks:
        status = (t.get("status") or "todo").lower()
        if status in columns:
            columns[status].append(t)
        else:
            columns["todo"].append(t)
    return columns


class FinalizePrdResponse(BaseModel):
    prd_status: str
    roadmap: Dict[str, Any] | None


@router.post(
    "/{workspace_id}/finalize-prd",
    response_model=FinalizePrdResponse,
    status_code=status.HTTP_200_OK,
)
async def finalize_workspace_prd(
    workspace_id: str,
    current_user=Depends(get_current_user),
) -> FinalizePrdResponse:
    db = get_db()
    workspaces = db["workspaces"]

    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")

    workspace = await workspaces.find_one({"_id": oid})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    prd = workspace.get("prd")
    if not prd:
        raise HTTPException(status_code=400, detail="No PRD to finalize")

    print("PRD FOUND:", prd)
    print("RUNNING PLANNING AGENT")

    from anyio import to_thread

    def _run() -> Dict[str, Any]:
        return run_planning_agent(prd, workspace.get("members", []))

    plan = await to_thread.run_sync(_run)
    print("PLANNING AGENT OUTPUT:", plan)

    roadmap = plan.get("roadmap") or {}
    # If the agent accidentally nested roadmap again, unwrap it defensively
    if isinstance(roadmap, dict) and "roadmap" in roadmap and isinstance(
        roadmap.get("roadmap"), dict
    ):
        roadmap = roadmap["roadmap"]

    print("SAVING ROADMAP:", roadmap)

    tasks = plan.get("tasks") or []
    kanban = _build_kanban(tasks)

    await workspaces.update_one(
        {"_id": oid},
        {
            "$set": {
                "prd_status": "final",
                "roadmap": roadmap,
                "tasks": tasks,
                "kanban": kanban,
                "plan_generated": True,
            }
        },
    )

    updated = await workspaces.find_one({"_id": oid})
    print("DATABASE ROADMAP:", updated.get("roadmap"))

    # Run one orchestrator tick (monitoring, etc.) in background
    try:
        from ..agents.orchestrator.project_orchestrator import start_project_graph
        await start_project_graph(workspace_id)
    except Exception as e:
        print("Orchestrator tick failed:", e)

    return FinalizePrdResponse(prd_status="final", roadmap=roadmap)


def _prd_to_markdown(prd: Dict[str, Any]) -> str:
    def section(title: str, body: str) -> str:
        return f"## {title}\n\n{body.strip()}\n\n"

    def list_section(title: str, items: list[str]) -> str:
        lines = "\n".join(f"- {item}" for item in items)
        return f"## {title}\n\n{lines}\n\n"

    md = "# Product Requirements Document\n\n"
    md += section("Product Overview", prd.get("overview", ""))
    md += section("Problem Statement", prd.get("problem_statement", ""))
    md += list_section("Target Users", prd.get("target_users", []))
    md += list_section("Market Analysis", prd.get("market_analysis", []))
    md += list_section("Key Features", prd.get("features", []))
    md += list_section("User Stories", prd.get("user_stories", []))
    md += list_section("Functional Requirements", prd.get("functional_requirements", []))
    md += list_section(
        "Non-Functional Requirements",
        prd.get("non_functional_requirements", []),
    )
    md += list_section("Technical Architecture", prd.get("system_architecture", []))
    md += list_section("Recommended Tech Stack", prd.get("tech_stack", []))
    md += list_section("Database Design", prd.get("database_design", []))
    md += list_section("API Design", prd.get("api_design", []))
    md += list_section("Security Considerations", prd.get("security", []))
    md += list_section("Performance Considerations", prd.get("performance", []))
    md += list_section("Deployment Strategy", prd.get("deployment", []))
    md += list_section("Project Folder Structure", prd.get("folder_structure", []))
    md += list_section("Milestones", prd.get("milestones", []))
    md += list_section("MVP Scope", prd.get("mvp_scope", []))
    md += list_section("Future Enhancements", prd.get("future_enhancements", []))
    return md


@router.get(
    "/{workspace_id}/prd/markdown",
    response_class=PlainTextResponse,
)
async def download_prd_markdown(
    workspace_id: str,
    current_user=Depends(get_current_user),
) -> PlainTextResponse:
    db = get_db()
    workspaces = db["workspaces"]

    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")

    workspace = await workspaces.find_one({"_id": oid})
    if not workspace or not workspace.get("prd"):
        raise HTTPException(status_code=404, detail="PRD not found")

    md = _prd_to_markdown(workspace["prd"])
    filename = f"workspace-{workspace_id}-prd.md"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
    }
    return PlainTextResponse(content=md, media_type="text/markdown", headers=headers)


@router.get(
    "/{workspace_id}/prd/pdf",
)
async def download_prd_pdf(
    workspace_id: str,
    current_user=Depends(get_current_user),
) -> Response:
    db = get_db()
    workspaces = db["workspaces"]

    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")

    workspace = await workspaces.find_one({"_id": oid})
    if not workspace or not workspace.get("prd"):
        raise HTTPException(status_code=404, detail="PRD not found")

    md = _prd_to_markdown(workspace["prd"])

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=LETTER)
    width, height = LETTER
    x = 40
    y = height - 40

    for line in md.splitlines():
        if y < 40:
            pdf.showPage()
            y = height - 40
        pdf.drawString(x, y, line)
        y -= 14

    pdf.save()
    buffer.seek(0)

    filename = f"workspace-{workspace_id}-prd.pdf"
    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
    }
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers=headers,
    )


class RoadmapResponse(BaseModel):
    roadmap: Dict[str, Any] | None


@router.get(
    "/{workspace_id}/roadmap",
    response_model=RoadmapResponse,
    status_code=status.HTTP_200_OK,
)
async def get_workspace_roadmap(
    workspace_id: str,
    current_user=Depends(get_current_user),
) -> RoadmapResponse:
    db = get_db()
    workspaces = db["workspaces"]

    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")

    workspace = await workspaces.find_one({"_id": oid})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    raw_roadmap = workspace.get("roadmap") or {}
    tasks = workspace.get("tasks") or []
    # Frontend expects roadmap to include phases and tasks
    roadmap = {
        "phases": raw_roadmap.get("phases", []),
        "tasks": tasks,
    }
    return RoadmapResponse(roadmap=roadmap)


class KanbanResponse(BaseModel):
    kanban: Dict[str, Any]
    tasks: List[Dict[str, Any]]


@router.get(
    "/{workspace_id}/kanban",
    response_model=KanbanResponse,
    status_code=status.HTTP_200_OK,
)
async def get_workspace_kanban(
    workspace_id: str,
    current_user=Depends(get_current_user),
) -> KanbanResponse:
    db = get_db()
    workspaces = db["workspaces"]
    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")
    workspace = await workspaces.find_one({"_id": oid})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    tasks = workspace.get("tasks") or []
    kanban = workspace.get("kanban") or _build_kanban(tasks)
    return KanbanResponse(kanban=kanban, tasks=tasks)


class NotificationsResponse(BaseModel):
    notifications: List[Dict[str, Any]]


@router.get(
    "/{workspace_id}/notifications",
    response_model=NotificationsResponse,
    status_code=status.HTTP_200_OK,
)
async def get_workspace_notifications(
    workspace_id: str,
    current_user=Depends(get_current_user),
) -> NotificationsResponse:
    db = get_db()
    workspaces = db["workspaces"]
    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")
    workspace = await workspaces.find_one({"_id": oid})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    notifications = workspace.get("notifications") or []
    return NotificationsResponse(notifications=notifications)


class RisksResponse(BaseModel):
    risks: List[Dict[str, Any]]


@router.get(
    "/{workspace_id}/risks",
    response_model=RisksResponse,
    status_code=status.HTTP_200_OK,
)
async def get_workspace_risks(
    workspace_id: str,
    current_user=Depends(get_current_user),
) -> RisksResponse:
    """
    Return AI-detected risks for the workspace.
    Risks are periodically updated by the background monitoring/risk agents.
    """
    db = get_db()
    workspaces = db["workspaces"]
    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")
    workspace = await workspaces.find_one({"_id": oid})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    risks = workspace.get("risks") or []
    return RisksResponse(risks=risks)


async def _run_agent_async(payload: GeneratePrdRequest) -> Dict[str, Any]:
    # LangGraph / OpenAI client are synchronous; run in thread to avoid blocking event loop
    from anyio import to_thread

    def _run() -> Dict[str, Any]:
        return run_requirements_agent(payload.model_dump())

    return await to_thread.run_sync(_run)

