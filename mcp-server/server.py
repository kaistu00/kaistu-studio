"""KAISTU Studio MCP Server — FastMCP setup and tool registration."""

import logging

from mcp.server.fastmcp import FastMCP

from tools import models as model_tools
from tools import system as system_tools
from tools import backend as backend_tools
from tools import huggingface as hf_tools
from tools import civitai as civitai_tools
from resources import models as model_resources

mcp = FastMCP("KAISTU Studio")


# ── Model Tools ──────────────────────────────────────────────

@mcp.tool()
async def scan_models(paths: list[str]) -> list[dict]:
    """Scan directories for AI model files (safetensors, ckpt, gguf, pt, pth, bin, etc.)."""
    return await model_tools.scan_models(paths)


@mcp.tool()
async def discover_model_paths() -> list[dict]:
    """Auto-discover known AI model folders (ComfyUI, A1111, InvokeAI, DiffusionBee, Fooocus, LTX Studio)."""
    return await model_tools.discover_model_paths()


@mcp.tool()
async def get_model_paths() -> list[str]:
    """Get saved custom model paths."""
    return await model_tools.get_model_paths()


@mcp.tool()
async def set_model_paths(paths: list[str]) -> None:
    """Save custom model paths for future scans."""
    await model_tools.set_model_paths(paths)


@mcp.tool()
async def reveal_model(path: str) -> dict:
    """Open file explorer at the given model file location."""
    return model_tools.reveal_model(path)


@mcp.tool()
async def delete_model(path: str) -> dict:
    """Move a model file to trash/recycle bin."""
    return model_tools.delete_model(path)


# ── System Tools ─────────────────────────────────────────────

@mcp.tool()
async def get_system_stats() -> dict:
    """Get CPU %, RAM (used/total/percent), and GPU info."""
    return system_tools.get_system_stats()


@mcp.tool()
async def get_system_capabilities(force: bool = False) -> dict:
    """Detect hardware capabilities (GPU type, VRAM, CPU count, feature level, etc.)."""
    return await backend_tools.get_system_capabilities(force)


@mcp.tool()
async def run_terminal(command: str) -> dict:
    """Execute a shell command and return stdout/stderr."""
    return system_tools.run_terminal(command)


# ── Backend Tools ────────────────────────────────────────────

@mcp.tool()
async def backend_health() -> dict:
    """Check if the KAISTU Studio Python backend (FastAPI) is running."""
    return await backend_tools.backend_health()


# ── API Keys ─────────────────────────────────────────────────

@mcp.tool()
async def list_api_keys() -> list[dict]:
    """List API key services configured in the backend."""
    return await backend_tools.list_api_keys()


@mcp.tool()
async def save_api_key(service: str, api_key: str) -> dict:
    """Save/update an API key for a service (encrypted via Fernet)."""
    return await backend_tools.save_api_key(service, api_key)


@mcp.tool()
async def delete_api_key(service: str) -> dict:
    """Delete an API key for a service."""
    return await backend_tools.delete_api_key(service)


# ── Upscalers ────────────────────────────────────────────────

@mcp.tool()
async def list_upscalers() -> list[dict]:
    """List all upscaler models with installation status."""
    return await backend_tools.list_upscalers()


@mcp.tool()
async def install_upscaler(model_id: str) -> dict:
    """Download and install an upscaler model by its model_id."""
    return await backend_tools.install_upscaler(model_id)


@mcp.tool()
async def run_upscaler(model_id: str, payload: dict) -> dict:
    """Run an upscale/clean/downscale/rescale operation via the backend.

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
      params: dict (tile_size, gpu_id, threads, tta)
    """
    return await backend_tools.run_upscaler(model_id, payload)


# ── Executions ───────────────────────────────────────────────

@mcp.tool()
async def list_executions() -> list[dict]:
    """List last 50 executions ordered by started_at desc."""
    return await backend_tools.list_executions()


@mcp.tool()
async def get_execution(exec_id: str) -> dict:
    """Get a single execution by its ID (status, progress, output_path, etc.)."""
    return await backend_tools.get_execution(exec_id)


@mcp.tool()
async def cancel_execution(exec_id: str) -> dict:
    """Cancel a pending or running execution."""
    return await backend_tools.cancel_execution(exec_id)


# ── Config ───────────────────────────────────────────────────

@mcp.tool()
async def get_config() -> dict:
    """Get the full KAISTU Studio configuration."""
    return await backend_tools.get_config()


@mcp.tool()
async def set_config(payload: dict) -> dict:
    """Merge payload into the KAISTU Studio configuration."""
    return await backend_tools.set_config(payload)


# ── Hugging Face Tools ───────────────────────────────────────

@mcp.tool()
async def search_huggingface(query: str) -> dict:
    """Search Hugging Face Hub for a model by filename. Returns primary match + secondary results."""
    return await hf_tools.search_hf_model(query)


@mcp.tool()
async def hf_text_leaderboard(limit: int = 10) -> list[dict]:
    """Top text-generation models from Hugging Face, sorted by downloads."""
    return await backend_tools.hf_text_leaderboard(limit)


@mcp.tool()
async def hf_text_recommended(vram_gb: float = 8.0, limit: int = 10) -> list[dict]:
    """Text-generation models recommended for a given VRAM capacity."""
    return await backend_tools.hf_text_recommended(vram_gb, limit)


@mcp.tool()
async def get_space_info(space_id: str) -> dict:
    """Get info about a Hugging Face Space, including reliability stats."""
    return await backend_tools.get_space_info(space_id)


@mcp.tool()
async def run_space(space_id: str, payload: dict) -> dict:
    """Run inference on a Hugging Face Space via its MCP endpoint."""
    return await backend_tools.run_space(space_id, payload)


# ── Civitai Tools ────────────────────────────────────────────

@mcp.tool()
async def search_civitai(query: str) -> dict:
    """Search Civitai for a model by name. Returns best match + alternative results."""
    return await civitai_tools.search_civitai_model(query)


# ── Generation ───────────────────────────────────────────────

@mcp.tool()
async def generate(payload: dict) -> dict:
    """Generate AI content (text, image, etc.) via the generation endpoint."""
    return await backend_tools.generate(payload)


# ── Resources ────────────────────────────────────────────────

@mcp.resource("kaistu://models/list")
async def models_list() -> str:
    """List all scanned models across saved paths as JSON."""
    return await model_resources.get_models_list()
