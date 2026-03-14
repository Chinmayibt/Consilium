import random
import string
from datetime import datetime
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from pymongo.collection import Collection

from ..database import get_db
from ..dependencies import get_current_user
from ..models.workspace import WorkspaceCreate, WorkspaceMember, WorkspacePublic

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def get_workspaces_collection() -> Collection:
    db = get_db()
    return db["workspaces"]


def generate_invite_code() -> str:
    def segment(n: int) -> str:
        return "".join(random.choices(string.ascii_uppercase + string.digits, k=n))

    return f"PROJ-{segment(4)}-{segment(4)}"


@router.post("", response_model=WorkspacePublic, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreate,
    current_user=Depends(get_current_user),
):
    if current_user["role"] != "manager":
        raise HTTPException(status_code=403, detail="Only managers can create workspaces")

    workspaces = get_workspaces_collection()
    invite_code = payload.invite_code or generate_invite_code()

    owner_id = str(current_user["_id"])
    member = WorkspaceMember(
        user_id=owner_id,
        name=current_user.get("name"),
        email=current_user.get("email"),
        role="manager",
    )

    doc = {
        "name": payload.name,
        "description": payload.description,
        "owner_id": owner_id,
        "invite_code": invite_code,
        "members": [member.model_dump()],
        "created_at": datetime.utcnow(),
        "status": "active",
        "tech_stack": payload.tech_stack,
        "team_size": payload.team_size,
        "deadline": payload.deadline,
    }

    result = await workspaces.insert_one(doc)

    # add workspace to user document
    db = get_db()
    await db["users"].update_one(
        {"_id": current_user["_id"]},
        {"$addToSet": {"workspaces": str(result.inserted_id)}},
    )

    return WorkspacePublic(
        id=str(result.inserted_id),
        name=doc["name"],
        description=doc.get("description"),
        invite_code=invite_code,
        tech_stack=doc.get("tech_stack"),
        team_size=doc.get("team_size"),
        deadline=doc.get("deadline"),
        owner_id=owner_id,
        members=[member],
        created_at=doc["created_at"],
        status="active",
    )


@router.get("", response_model=List[WorkspacePublic])
async def list_workspaces(current_user=Depends(get_current_user)):
    workspaces = get_workspaces_collection()
    user_id = str(current_user["_id"])
    cursor = workspaces.find(
        {
            "$or": [
                {"owner_id": user_id},
                {"members.user_id": user_id},
            ]
        }
    )

    results: List[WorkspacePublic] = []
    async for w in cursor:
        members = [
            WorkspaceMember(**m) for m in w.get("members", [])
        ]
        results.append(
            WorkspacePublic(
                id=str(w["_id"]),
                name=w["name"],
                description=w.get("description"),
                invite_code=w.get("invite_code"),
                tech_stack=w.get("tech_stack"),
                team_size=w.get("team_size"),
                deadline=w.get("deadline"),
                owner_id=w["owner_id"],
                members=members,
                created_at=w["created_at"],
                status=w.get("status", "active"),
            )
        )
    return results


class JoinPayload(BaseModel):
    invite_code: str


@router.post("/join", response_model=WorkspacePublic)
async def join_workspace(
    payload: JoinPayload,
    current_user=Depends(get_current_user),
):
    workspaces = get_workspaces_collection()
    w = await workspaces.find_one({"invite_code": payload.invite_code})
    if not w:
        raise HTTPException(status_code=404, detail="Workspace not found")

    user_id = str(current_user["_id"])
    if any(m.get("user_id") == user_id for m in w.get("members", [])):
        # already a member
        pass
    else:
        member = WorkspaceMember(
            user_id=user_id,
            name=current_user.get("name"),
            email=current_user.get("email"),
            role=current_user["role"],
        )
        await workspaces.update_one(
            {"_id": w["_id"]},
            {"$addToSet": {"members": member.model_dump()}},
        )

        db = get_db()
        await db["users"].update_one(
            {"_id": current_user["_id"]},
            {"$addToSet": {"workspaces": str(w["_id"])}},
        )
        # refresh workspace doc
        w = await workspaces.find_one({"_id": w["_id"]})

    members = [WorkspaceMember(**m) for m in w.get("members", [])]
    return WorkspacePublic(
        id=str(w["_id"]),
        name=w["name"],
        description=w.get("description"),
        invite_code=w.get("invite_code"),
        tech_stack=w.get("tech_stack"),
        team_size=w.get("team_size"),
        deadline=w.get("deadline"),
        owner_id=w["owner_id"],
        members=members,
        created_at=w["created_at"],
        status=w.get("status", "active"),
    )


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workspace(workspace_id: str, current_user=Depends(get_current_user)):
    workspaces = get_workspaces_collection()
    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")

    w = await workspaces.find_one({"_id": oid})
    if not w:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if w["owner_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Only the owner can delete a workspace")

    await workspaces.delete_one({"_id": oid})

    db = get_db()
    await db["users"].update_many(
        {},
        {"$pull": {"workspaces": workspace_id}},
    )

    return None


@router.delete(
    "/{workspace_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_member(
    workspace_id: str,
    member_id: str,
    current_user=Depends(get_current_user),
):
    workspaces = get_workspaces_collection()
    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")

    w = await workspaces.find_one({"_id": oid})
    if not w:
        raise HTTPException(status_code=404, detail="Workspace not found")

    owner_id = str(w["owner_id"])
    # Only managers (including owner) can remove members
    if current_user.get("role") != "manager":
        raise HTTPException(
            status_code=403, detail="Only managers can remove members"
        )

    if member_id == owner_id:
        raise HTTPException(
            status_code=400, detail="Manager cannot remove themselves from workspace"
        )

    await workspaces.update_one(
        {"_id": oid},
        {"$pull": {"members": {"user_id": member_id}}},
    )

    db = get_db()
    await db["users"].update_one(
        {"_id": ObjectId(member_id)},
        {"$pull": {"workspaces": workspace_id}},
    )

    return None

