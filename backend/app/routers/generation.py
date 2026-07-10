import uuid
from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter()


@router.post("/generate")
async def generate(payload: dict):
    """Placeholder for AI generation. Will dispatch to the appropriate model."""
    return {
        "id": str(uuid.uuid4()),
        "prompt": payload.get("prompt", ""),
        "mediaType": payload.get("mediaType", "text"),
        "status": "done",
        "outputUrl": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/projects")
async def list_projects():
    """Placeholder: list saved projects."""
    return {"projects": []}
