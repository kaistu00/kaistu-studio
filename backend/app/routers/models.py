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
async def set_model_paths(payload: list[str]):
    _save_paths(payload)
    return {"saved": len(payload)}


@router.get("/models/discover")
async def discover_model_paths():
    return models_lib.discover_model_paths()


@router.post("/models/scan")
async def scan_model_paths(sources: list[dict]):
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
    """Text-generation models recommended for your VRAM capacity.

    Rules:
    - ~1GB VRAM per 2B parameters for inference (conservative: 2B/GB)
    - Extract model size from ID (e.g., "Qwen-7B" -> 7B)
    """
    # Conservative: 2B params per 1GB VRAM, with 70% safety margin
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

            # Extract model size from ID (most reliable source)
            # Patterns: "-0.6B", "-7B", "-13B", "-30B", "-70B", "-128B"
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

            # Also check tags for size (secondary source)
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

            # Include models if:
            # 1. Have size tag and fit in VRAM
            # 2. No explicit size but VRAM >= 6GB (assume reasonable size)
            if size_match is not None:
                if size_match <= max_params:
                    candidates.append({"id": model_id, "size_b": size_match})
            elif vram_gb >= 6:
                candidates.append({"id": model_id, "size_b": None})

        return sorted(candidates, key=lambda x: x.get("id", ""), reverse=True)[:limit]

@router.get("/spaces/info/{space_id:path}")
async def get_space_info(space_id: str):
    """Get Space info including reliability stats."""
    # space_id may come with / replaced by : or still with /
    safe_id = space_id.replace(":", "/")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Get space runtime stats - shows success/failure info
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
async def run_space(space_id: str, payload: dict):
    """Generic Space inference endpoint - routes to specific implementations."""
    safe_id = space_id.replace(":", "/")
    print(f"[SPACES] Routing request to space: {safe_id}")
    
    if safe_id in ["qwen-image-edit", "Qwen/Qwen-Image-Edit-2511"]:
        return await qwen_image_edit_impl(payload)
    
    if safe_id in ["pro-realism-edit", "Sneak-Moose/Pro-Realism-Edit-Studio"]:
        return await generic_space_edit(safe_id, payload)
    
    return {"type": "error", "message": f"Unknown space: {safe_id}"}


async def generic_space_edit(space_id: str, payload: dict):
    """Generic Gradio Space image edit endpoint."""
    import base64
    from gradio_client import Client, handle_file
    import tempfile
    
    image_b64 = payload.get("image", "")
    prompt = payload.get("prompt", "")
    
    print(f"[SPACES] === {space_id} called ===")
    
    try:
        client = Client(space_id)
        print(f"[SPACES] Client created, calling predict...")
        
        # Most Gradio Spaces use /predict, some use /infer
        endpoints_to_try = ["/infer", "/predict"]
        
        # Try with image input first
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            f.write(base64.b64decode(image_b64))
            temp_path = f.name
        
        for api_name in endpoints_to_try:
            try:
                result = client.predict(
                    prompt=prompt,
                    image=handle_file(temp_path),
                    api_name=api_name
                )
                print(f"[SPACES] {api_name} returned: {type(result).__name__}")
                break
            except Exception as e:
                print(f"[SPACES] {api_name} failed: {e}")
                continue
        else:
            return {"type": "error", "message": "No valid endpoint found"}
        
        # Handle image output
        if isinstance(result, dict) and result.get("path"):
            with open(result["path"], "rb") as img:
                return {"type": "image", "data": base64.b64encode(img.read()).decode()}
        elif isinstance(result, list) and len(result) > 0:
            output = result[0]
            if isinstance(output, dict) and output.get("path"):
                with open(output["path"], "rb") as img:
                    return {"type": "image", "data": base64.b64encode(img.read()).decode()}
        
        return {"type": "error", "message": "Unexpected output format"}
    except Exception as e:
        print(f"[SPACES] ERROR: {e}")
        return {"type": "error", "message": str(e)}
    finally:
        try: os.unlink(temp_path)
        except: pass


async def qwen_image_edit_impl(payload: dict):
    """Run image edit on a Gradio Space."""
    import base64
    from gradio_client import Client, handle_file
    import tempfile
    
    Space = "Qwen/Qwen-Image-Edit-2511"
    image_b64 = payload.get("image", "")
    prompt = payload.get("prompt", "")
    
    print(f"[SPACES] === {Space} called ===")
    print(f"[SPACES] prompt: '{prompt[:50]}...' ({len(prompt)} chars)")
    
    if not image_b64:
        return {"type": "error", "message": "No image provided"}
    
    try:
        client = Client(Space)
        print(f"[SPACES] Client created, calling predict...")
        
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            f.write(base64.b64decode(image_b64))
            temp_path = f.name
        
        try:
            result = client.predict(
                images=[handle_file(temp_path)],
                prompt=prompt,
                api_name="/infer"
            )
            
            print(f"[SPACES] predict() returned type: {type(result).__name__}")
            if result and len(result) > 0:
                output_path = result[0][0].get("path") if isinstance(result[0], list) else result[0].get("path")
                print(f"[SPACES] Output: {output_path}")
                if output_path and os.path.exists(output_path):
                    with open(output_path, "rb") as img:
                        img_b64 = base64.b64encode(img.read()).decode()
                        return {"type": "image", "data": img_b64}
            return {"type": "error", "message": "No output from Space"}
        finally:
            os.unlink(temp_path)
    except Exception as e:
        print(f"[SPACES] ERROR: {e}")
        return {"type": "error", "message": str(e)}
    """Run Qwen Image Edit Space inference.
    
    Uses gradio_client to call the Space API.
    """
    import base64
    
    image_b64 = payload.get("image", "")
    prompt = payload.get("prompt", "")
    
    print(f"[SPACES] === qwen-image-edit called ===")
    print(f"[SPACES] prompt: '{prompt[:50]}{'...' if len(prompt) > 50 else ''}' ({len(prompt)} chars)")
    print(f"[SPACES] image: {len(image_b64)} base64 chars")
    
    try:
        from gradio_client import Client, handle_file
        print("[SPACES] Creating gradio_client for Qwen/Qwen-Image-Edit-2511...")
        client = Client("Qwen/Qwen-Image-Edit-2511")
        print("[SPACES] Client created, calling predict...")
        
        # Decode base64 image to temp file for gradio_client
        import tempfile
        
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            f.write(base64.b64decode(image_b64))
            temp_path = f.name
        print(f"[SPACES] Temp image file: {temp_path}")
        
        try:
            result = client.predict(
                images=[handle_file(temp_path)],
                prompt=prompt,
                api_name="/infer"
            )
            
            print(f"[SPACES] predict() returned type: {type(result).__name__}")
            
            if result and len(result) > 0:
                print(f"[SPACES] result[0] type: {type(result[0])}")
                if isinstance(result[0], list) and len(result[0]) > 0:
                    output = result[0][0]
                    print(f"[SPACES] output type: {type(output)}, keys: {list(output.keys()) if isinstance(output, dict) else 'N/A'}")
                    output_path = output.get("path") if isinstance(output, dict) else None
                elif isinstance(result[0], dict):
                    output_path = result[0].get("path")
                else:
                    output_path = None
                    
                print(f"[SPACES] Output path extracted: {output_path}")
                if output_path and os.path.exists(output_path):
                    with open(output_path, "rb") as img:
                        img_b64 = base64.b64encode(img.read()).decode()
                        print(f"[SPACES] SUCCESS - returning image, size: {len(img_b64)} chars")
                        return {"type": "image", "data": img_b64}
                else:
                    print(f"[SPACES] ERROR - path does not exist")
            
            print("[SPACES] ERROR - No output received from predict")
            return {"type": "error", "message": "No output received"}
        finally:
            os.unlink(temp_path)
            print(f"[SPACES] Cleaned up temp file")
    except ImportError as e:
        print(f"[SPACES] ERROR - gradio_client not installed: {e}")
        return {"type": "error", "message": "gradio_client not installed"}
    except Exception as e:
        print(f"[SPACES] ERROR - {type(e).__name__}: {e}")
        return {"type": "error", "message": str(e)}