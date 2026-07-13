import json
import os
import re
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models_lib
from app.database import get_db
from app.models.api_key import APIKey
from app.routers.api_keys import decrypt

router = APIRouter()

_PATHS_FILE = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "kaistu-studio", "model-paths.json")
_MODELS_DIR = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "kaistu-studio", "models")


def _load_paths() -> list[str]:
    try:
        if os.path.exists(_PATHS_FILE):
            return json.loads(Path(_PATHS_FILE).read_text())
    except (OSError, json.JSONDecodeError):
        pass
    return []


def _save_paths(paths: list[str]) -> None:
    os.makedirs(os.path.dirname(_PATHS_FILE), exist_ok=True)
    Path(_PATHS_FILE).write_text(json.dumps(paths, indent=2))


def _hf_token() -> str | None:
    token_path = Path(os.path.expanduser("~")) / ".cache" / "huggingface" / "token"
    try:
        if token_path.exists():
            return token_path.read_text().strip() or None
    except OSError:
        pass
    return None


@router.get("/models/paths")
async def get_model_paths():
    return _load_paths()


@router.post("/models/paths")
async def set_model_paths(paths: list[str]):
    _save_paths(paths)
    return {"saved": len(paths)}


@router.get("/models/discover")
async def discover_model_paths():
    return models_lib.discover_model_paths()


@router.post("/models/scan")
async def scan_models(sources: list[dict]):
    return models_lib.scan_models(sources)


@router.post("/models/delete")
async def delete_model_file(payload: dict):
    path = payload.get("path", "")
    if not path:
        raise HTTPException(status_code=400, detail="path required")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="file not found")
    os.remove(path)
    return {"deleted": path}


@router.post("/models/download")
async def download_model(payload: dict, db: Session = Depends(get_db)):
    url = payload.get("url", "")
    filename = payload.get("filename", "")
    model_type = payload.get("type", "other")
    if not url or not filename:
        raise HTTPException(status_code=400, detail="url and filename required")
    dest_dir = os.path.join(_MODELS_DIR, model_type)
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, filename)
    headers: dict[str, str] = {}
    if "civitai.com" in url.lower() or "civitai.red" in url.lower():
        key_record = db.query(APIKey).filter(APIKey.service == "civitai").first()
        if key_record:
            headers["Authorization"] = f"Bearer {decrypt(key_record.encrypted_key)}"
    try:
        async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            Path(dest_path).write_bytes(resp.content)
        return {"success": True, "path": dest_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models/hf-text-leaderboard")
async def hf_text_leaderboard(limit: int = 10):
    """Top text-generation models from HuggingFace."""
    token = _hf_token()
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
        resp = await client.get(
            "https://huggingface.co/api/models",
            params={"pipeline_tag": "text-generation", "sort": "downloads", "limit": limit * 3},
        )
        if resp.status_code != 200:
            return []
        data = resp.json() or []
        models = []
        for m in data[:limit]:
            models.append({
                "id": m.get("id"),
            })
        return models


@router.get("/models/hf-text-recommended")
async def hf_text_recommended(vram_gb: float = 8.0, limit: int = 10):
    """Text-generation models recommended for your VRAM capacity."""
    max_params = int(vram_gb * 2 * 0.7)

    headers: dict[str, str] = {"Content-Type": "application/json"}
    token = _hf_token()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient(timeout=15.0, headers=headers) as client:
        resp = await client.get(
            "https://huggingface.co/api/models",
            params={"pipeline_tag": "text-generation", "sort": "downloads", "limit": limit * 4},
        )
        if resp.status_code != 200:
            return []
        data = resp.json() or []

        candidates = []
        for m in data:
            model_id = m.get("id", "")
            tags = m.get("tags", []) or []

            size_match = None
            id_patterns = [
                r"-(\d+\.?\d*)[bB](?:-|$|Instruct|Base)",
                r"-(\d+\.?\d*)b-",
                r"[-/](\d+\.?\d*)B[-/]",
            ]
            for pattern in id_patterns:
                match = re.search(pattern, model_id)
                if match:
                    size_val = match.group(1)
                    size_match = int(float(size_val))
                    break

            if not size_match:
                tag_patterns = [r"^(\d+\.?\d*)[bB]$", r"^(\d+\.?\d*)[bB]-parameter"]
                for t in tags:
                    t_str = str(t).lower()
                    for pattern in tag_patterns:
                        match = re.match(pattern, t_str)
                        if match:
                            size_match = int(float(match.group(1)))
                            break
                    if size_match:
                        break

            if size_match is not None:
                if size_match <= max_params:
                    candidates.append({"id": model_id, "size_b": size_match})
            elif vram_gb >= 6:
                candidates.append({"id": model_id, "size_b": None})

        return sorted(candidates, key=lambda x: x.get("id", ""), reverse=True)[:limit]


@router.get("/spaces/info/{space_id:path}")
async def get_space_info(space_id: str):
    """Get Space info including reliability stats."""
    safe_id = space_id.replace(":", "/")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"https://huggingface.co/api/spaces/{safe_id}/runtime")
            if resp.status_code == 200:
                data = resp.json()
                stage = data.get("stage_times", {})
                if not stage:
                    return {"reliability": "checking..."}
                return {"reliability": "live", "data": data}
        return {"reliability": "unknown"}
    except Exception as e:
        return {"reliability": "error", "error": str(e)}


@router.post("/spaces/{space_id:path}")
async def run_space(space_id: str, payload: dict, db: Session = Depends(get_db)):
    """Generic Space inference endpoint."""
    safe_id = space_id.replace(":", "/")
    print(f"[SPACES] Routing request to space: {safe_id}")
    
    # Get HF token from DB
    hf_token: str | None = None
    key_record = db.query(APIKey).filter(APIKey.service == "huggingface").first()
    if key_record:
        hf_token = decrypt(key_record.encrypted_key)
    
    return await mcp_space_call(safe_id, payload)


async def mcp_space_call(space_id: str, payload: dict):
    """Call Space via MCP HTTP endpoint."""
    import base64

    image_b64 = payload.get("image", "")
    prompt = payload.get("prompt", "")
    
    print(f"[SPACES] === {space_id} MCP called ===")
    
    try:
        space_slug = space_id.replace("/", "-").lower()
        mcp_url = f"https://{space_slug}.hf.space/gradio_api/mcp/"
        print(f"[SPACES] MCP URL: {mcp_url}")
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            mcp_payload = {
                "inputs": [
                    {"data": prompt, "name": "prompt"},
                    {"data": image_b64, "name": "image"}
                ]
            }
            resp = await client.post(mcp_url, json=mcp_payload)
            print(f"[SPACES] MCP response: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                print(f"[SPACES] MCP data keys: {list(data.keys()) if isinstance(data, dict) else 'not dict'}")
                if isinstance(data, dict) and "data" in data:
                    return {"type": "success", "raw": data}
            return {"type": "error", "message": f"MCP returned {resp.status_code}"}
    except Exception as e:
        print(f"[SPACES] MCP ERROR: {e}")
        return {"type": "error", "message": str(e)}


def _extract_image_result(result, temp_path: str | None) -> dict:
    import base64
    print(f"[SPACES] _extract_image_result: type={type(result).__name__}")
    print(f"[SPACES] Raw result sample: {str(result)[:500]}")
    
    if isinstance(result, tuple) and len(result) > 0:
        print(f"[SPACES] Tuple length: {len(result)}")
        first_item = result[0]
        if isinstance(first_item, list) and len(first_item) > 0 and isinstance(first_item[0], dict):
            image_path = first_item[0].get("image")
            if image_path and os.path.exists(image_path):
                with open(image_path, "rb") as img:
                    return {"type": "image", "data": base64.b64encode(img.read()).decode()}
    
    if isinstance(result, list) and len(result) > 0:
        for item in result:
            if isinstance(item, str) and item.endswith(('.png', '.jpg')) and os.path.exists(item):
                with open(item, "rb") as img:
                    return {"type": "image", "data": base64.b64encode(img.read()).decode()}
            elif isinstance(item, dict):
                image_path = item.get("image") or item.get("path")
                if image_path and os.path.exists(image_path):
                    with open(image_path, "rb") as img:
                        return {"type": "image", "data": base64.b64encode(img.read()).decode()}
    
    return {"type": "error", "message": f"Unexpected output format: {type(result).__name__}, sample: {str(result)[:200]}"}