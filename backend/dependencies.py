from typing import Annotated, Optional

from bson import ObjectId
from fastapi import Cookie, HTTPException, Header, status
from pymongo.collection import Collection

from .auth import decode_token
from .database import get_db


def get_users_collection() -> Collection:
    db = get_db()
    users: Collection = db["users"]
    return users


async def get_current_user(
    authorization: Annotated[Optional[str], Header()] = None,
    access_token_cookie: Annotated[Optional[str], Cookie(alias="access_token")] = None,
):
    token: Optional[str] = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    elif access_token_cookie:
        token = access_token_cookie

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    users = get_users_collection()
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user id in token",
        )

    doc = await users.find_one({"_id": oid})
    if doc is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return doc


async def ensure_workspace_member(workspace_id: str, current_user: dict):
    """Raise 403 if current_user is not a member of the workspace."""
    db = get_db()
    workspaces = db["workspaces"]
    try:
        oid = ObjectId(workspace_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid workspace id")

    ws = await workspaces.find_one({"_id": oid})
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    uid = str(current_user["_id"])
    if uid != ws.get("owner_id") and not any(
        m.get("user_id") == uid for m in ws.get("members", [])
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this workspace",
        )

    return ws



