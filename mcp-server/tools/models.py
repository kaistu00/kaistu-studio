"""Model management tools — most delegate to backend; reveal/delete stay local."""

import os
from pathlib import Path

import httpx
import send2trash

BACKEND_URL = "http://127.0.0.1:8000"


async def _fetch(path: str, method: str = "GET", body: dict | list | None = None) -> dict | list:
    url = f"{BACKEND_URL}/api/v1{path}"
    async with httpx.AsyncClient(timeout=10) as client:
        if method == "GET":
            resp = await client.get(url, headers={"Content-Type": "application/json"})
        elif method == "POST":
            resp = await client.post(url, json=body, headers={"Content-Type": "application/json"})
        else:
            raise ValueError(f"Unsupported method: {method}")
        resp.raise_for_status()
        return resp.json()


async def scan_models(paths: list[str]) -> list[dict]:
    """Scan directories for AI model files. Delegates to backend."""
    sources = [{"path": p, "label": Path(p).parent.name or "Modelos"} for p in paths]
    result = await _fetch("/models/scan", method="POST", body=sources)
    return result if isinstance(result, list) else []


async def discover_model_paths() -> list[dict]:
    """Auto-discover known AI model folders. Delegates to backend."""
    result = await _fetch("/models/discover")
    return result if isinstance(result, list) else []


async def get_model_paths() -> list[str]:
    """Get saved custom model paths from backend."""
    result = await _fetch("/models/paths")
    return result if isinstance(result, list) else []


async def set_model_paths(paths: list[str]) -> None:
    """Save custom model paths via backend."""
    await _fetch("/models/paths", method="POST", body=paths)


def reveal_model(path: str) -> dict:
    """Open file explorer at the given model file location."""
    path_obj = Path(path)
    if not path_obj.exists():
        return {"success": False, "error": "File not found"}
    os.startfile(str(path_obj.parent))
    return {"success": True}


def delete_model(path: str) -> dict:
    """Move a model file to trash/recycle bin."""
    path_obj = Path(path)
    if not path_obj.exists():
        return {"success": False, "error": "File not found"}
    try:
        send2trash.send2trash(str(path_obj))
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}
