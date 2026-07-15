"""Backend tools: health, API keys, upscalers, executions, config, generation, HF leaderboard/spaces."""

import httpx

BACKEND_URL = "http://127.0.0.1:8000"


async def _fetch(path: str, method: str = "GET", body: dict | list | None = None,
                 timeout: float = 10) -> dict | list:
    url = f"{BACKEND_URL}/api/v1{path}"
    async with httpx.AsyncClient(timeout=timeout) as client:
        if method == "GET":
            resp = await client.get(url, headers={"Content-Type": "application/json"})
        elif method == "POST":
            resp = await client.post(url, json=body, headers={"Content-Type": "application/json"})
        elif method == "DELETE":
            resp = await client.delete(url, headers={"Content-Type": "application/json"})
        else:
            raise ValueError(f"Unsupported method: {method}")
        resp.raise_for_status()
        return resp.json()


async def backend_health() -> dict:
    """Check if the Python backend is running."""
    try:
        result = await _fetch("/health")
        return {"status": "healthy", "service": "kaistu-studio-backend", "detail": result}
    except Exception as e:
        return {"status": "unreachable", "error": str(e)}


# ── API Keys ─────────────────────────────────────────────────

async def list_api_keys() -> list[dict]:
    """List configured API key services (keys are never returned in plaintext)."""
    try:
        result = await _fetch("/api-keys")
        return result if isinstance(result, list) else []
    except Exception as e:
        return [{"error": str(e)}]


async def save_api_key(service: str, api_key: str) -> dict:
    """Save or update an API key for a service (encrypted via Fernet on the backend)."""
    try:
        result = await _fetch("/api-keys", method="POST",
                              body={"service": service, "api_key": api_key})
        return result if isinstance(result, dict) else {"service": service}
    except Exception as e:
        return {"error": str(e)}


async def delete_api_key(service: str) -> dict:
    """Delete an API key for a service."""
    try:
        result = await _fetch(f"/api-keys/{service}", method="DELETE")
        return result if isinstance(result, dict) else {"deleted": service}
    except Exception as e:
        return {"error": str(e)}


# ── Upscalers ────────────────────────────────────────────────

async def list_upscalers() -> list[dict]:
    """List all upscaler models with installation status."""
    try:
        result = await _fetch("/upscalers")
        return result if isinstance(result, list) else []
    except Exception as e:
        return [{"error": str(e)}]


async def install_upscaler(model_id: str) -> dict:
    """Download and install an upscaler model by its model_id."""
    try:
        result = await _fetch(f"/upscalers/{model_id}/install", method="POST",
                              timeout=120)
        return result if isinstance(result, dict) else {"success": True}
    except Exception as e:
        return {"error": str(e)}


async def run_upscaler(model_id: str, payload: dict) -> dict:
    """Run an upscale/clean/downscale/rescale operation.

    Payload fields:
      mode: "upscale"|"downscale"|"rescale"|"clean"
      input_path: str (required)
      output_path: str (required)
      scale: int (default 4)
      input_width: int
      input_height: int
      file_size: str
      target_width: int (for rescale mode)
      target_height: int (for rescale mode)
      face_enhance: bool (default false)
      params: dict (CLI flags like tile_size, gpu_id, threads, tta)
    """
    try:
        result = await _fetch(f"/upscalers/{model_id}/run", method="POST",
                              body=payload, timeout=30)
        return result if isinstance(result, dict) else {"exec_id": str(result)}
    except Exception as e:
        return {"error": str(e)}


# ── Executions ───────────────────────────────────────────────

async def list_executions() -> list[dict]:
    """List last 50 executions ordered by started_at desc."""
    try:
        result = await _fetch("/executions")
        return result if isinstance(result, list) else []
    except Exception as e:
        return [{"error": str(e)}]


async def get_execution(exec_id: str) -> dict:
    """Get a single execution by its ID (status, progress, output_path, etc.)."""
    try:
        result = await _fetch(f"/executions/{exec_id}")
        return result if isinstance(result, dict) else {"error": "not found"}
    except Exception as e:
        return {"error": str(e)}


async def cancel_execution(exec_id: str) -> dict:
    """Cancel a pending or running execution by its ID."""
    try:
        result = await _fetch(f"/executions/{exec_id}", method="DELETE")
        return result if isinstance(result, dict) else {"success": True}
    except Exception as e:
        return {"error": str(e)}


# ── Config ───────────────────────────────────────────────────

async def get_config() -> dict:
    """Get the full KAISTU Studio configuration (from config.json)."""
    try:
        result = await _fetch("/config")
        return result if isinstance(result, dict) else {}
    except Exception as e:
        return {"error": str(e)}


async def set_config(payload: dict) -> dict:
    """Merge payload into the KAISTU Studio configuration."""
    try:
        result = await _fetch("/config", method="POST", body=payload)
        return result if isinstance(result, dict) else {"success": True}
    except Exception as e:
        return {"error": str(e)}


# ── System Capabilities ──────────────────────────────────────

async def get_system_capabilities(force: bool = False) -> dict:
    """Detect hardware capabilities (GPU type, VRAM, CPU count, features list)."""
    try:
        result = await _fetch(f"/system/capabilities?force={str(force).lower()}")
        return result if isinstance(result, dict) else {}
    except Exception as e:
        return {"error": str(e)}


# ── HF Text Leaderboard / Recommendations ────────────────────

async def hf_text_leaderboard(limit: int = 10) -> list[dict]:
    """Top text-generation models from Hugging Face, sorted by downloads."""
    try:
        result = await _fetch(f"/models/hf-text-leaderboard?limit={limit}")
        return result if isinstance(result, list) else []
    except Exception as e:
        return [{"error": str(e)}]


async def hf_text_recommended(vram_gb: float = 8.0, limit: int = 10) -> list[dict]:
    """Text-generation models recommended for a given VRAM capacity."""
    try:
        result = await _fetch(
            f"/models/hf-text-recommended?vram_gb={vram_gb}&limit={limit}")
        return result if isinstance(result, list) else []
    except Exception as e:
        return [{"error": str(e)}]


# ── HF Spaces ────────────────────────────────────────────────

async def get_space_info(space_id: str) -> dict:
    """Get info about a Hugging Face Space, including reliability stats."""
    try:
        result = await _fetch(f"/spaces/info/{space_id}")
        return result if isinstance(result, dict) else {}
    except Exception as e:
        return {"error": str(e)}


async def run_space(space_id: str, payload: dict) -> dict:
    """Run inference on a Hugging Face Space via its MCP endpoint."""
    try:
        result = await _fetch(f"/spaces/{space_id}", method="POST",
                              body=payload, timeout=60)
        return result if isinstance(result, dict) else {}
    except Exception as e:
        return {"error": str(e)}


# ── Generation (placeholder) ─────────────────────────────────

async def generate(payload: dict) -> dict:
    """Generate AI content (text, image, etc.) — placeholder endpoint."""
    try:
        result = await _fetch("/generate", method="POST", body=payload, timeout=60)
        return result if isinstance(result, dict) else {}
    except Exception as e:
        return {"error": str(e)}
