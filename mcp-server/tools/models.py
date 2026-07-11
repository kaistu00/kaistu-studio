"""Model management tools: scan, discover, reveal, delete."""

import json
import os
from pathlib import Path

import send2trash

MODEL_EXTENSIONS = {
    ".ckpt", ".safetensors", ".pt", ".pth", ".bin",
    ".vae.pt", ".vae.safetensors", ".patch", ".gguf", ".gguf_model",
}

FOLDER_TYPE_MAP: dict[str, str] = {
    "checkpoint": "checkpoint", "checkpoints": "checkpoint",
    "diffusion_models": "checkpoint", "stable-diffusion": "checkpoint",
    "lora": "lora", "loras": "lora", "lycoris": "lora",
    "vae": "vae", "vaes": "vae",
    "clip": "clip", "clips": "clip",
    "clip_vision": "clip_vision",
    "text_encoder": "text_encoder", "text_encoders": "text_encoder",
    "controlnet": "controlnet", "controlnets": "controlnet", "cnet": "controlnet",
    "upscaler": "upscaler", "upscalers": "upscaler", "upscale_models": "upscaler",
    "embedding": "embedding", "embeddings": "embedding",
    "unet": "unet", "unets": "unet",
    "gligen": "gligen",
    "style_model": "style_model", "style_models": "style_model",
    "hypernetwork": "hypernetwork", "hypernetworks": "hypernetwork",
    "inpaint": "inpaint",
}

SKIP_DIRS = {
    "node_modules", ".git", ".svn", "__pycache__",
    "temp", "tmp", "logs", "log", ".npm", ".yarn", ".pnpm",
    "Microsoft", "Windows", "WinSxS", "System32", "SysWOW64",
    "Intel", "AMD", "NVIDIA", "Package Cache", "Installer",
    "Common Files", "Internet Explorer", "MSBuild",
}

CONFIG_DIR = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming")) / "kaistu-studio"
MODEL_PATHS_FILE = CONFIG_DIR / "model-paths.json"


def _is_model_file(name: str) -> bool:
    lower = name.lower()
    return any(lower.endswith(ext) for ext in MODEL_EXTENSIONS)


def _detect_type_by_folder(folder: str) -> str | None:
    lower = folder.lower().replace(" ", "_").replace("-", "_")
    segments = lower.split("/")
    for seg in segments:
        normalized = seg.rstrip("_")
        for key, val in FOLDER_TYPE_MAP.items():
            if normalized == key or normalized == key.replace("_", ""):
                return val
    return None


def _detect_type_by_name(name: str) -> str:
    lower = name.lower()
    if "clip_vision" in lower or "clip-vision" in lower:
        return "clip_vision"
    if "vae" in lower:
        return "vae"
    if "lora" in lower or "lycoris" in lower:
        return "lora"
    if "embedding" in lower or "textual" in lower:
        return "embedding"
    if "control" in lower or "cnet" in lower:
        return "controlnet"
    if "upscale" in lower or "esrgan" in lower or "realesr" in lower:
        return "upscaler"
    if "unet" in lower:
        return "unet"
    if "gligen" in lower:
        return "gligen"
    if "style" in lower or "style_model" in lower:
        return "style_model"
    if "hypernetwork" in lower or "hyper_network" in lower:
        return "hypernetwork"
    if "inpaint" in lower:
        return "inpaint"
    if "clip" in lower:
        return "clip"
    if lower.endswith((".safetensors", ".ckpt", ".pt", ".pth", ".gguf", ".gguf_model")):
        return "checkpoint"
    return "other"


def _get_software_label(path: str) -> str:
    lower = path.lower()
    if "comfy" in lower:
        return "ComfyUI"
    if "stable-diffusion-webui" in lower or "a1111" in lower:
        return "A1111 / Forge"
    if "invokeai" in lower:
        return "InvokeAI"
    if "diffusionbee" in lower:
        return "DiffusionBee"
    if "fooocus" in lower:
        return "Fooocus"
    if "ltx" in lower:
        return "LTX Studio"
    return Path(path).parent.name or "Modelos"


def scan_directory(root: str) -> list[dict]:
    """Scan a single directory recursively (max depth 5) for model files."""
    results: list[dict] = []
    root_path = Path(root)
    if not root_path.exists():
        return results

    def walk(d: Path, depth: int):
        if depth > 5:
            return
        try:
            for entry in d.iterdir():
                if entry.is_dir():
                    walk(entry, depth + 1)
                elif entry.is_file() and _is_model_file(entry.name):
                    try:
                        size_mb = entry.stat().st_size / (1024 * 1024)
                        folder = str(entry.relative_to(root_path).parent).replace("\\", "/")
                        results.append({
                            "name": entry.name,
                            "path": str(entry),
                            "type": "",
                            "sizeMB": round(size_mb, 2),
                            "folder": folder,
                        })
                    except OSError:
                        pass
        except PermissionError:
            pass

    walk(root_path, 0)
    return results


def scan_models(paths: list[str]) -> list[dict]:
    """Scan multiple paths for model files with type detection."""
    all_models: list[dict] = []
    for p in paths:
        if not Path(p).exists():
            continue
        files = scan_directory(p)
        for f in files:
            folder_type = _detect_type_by_folder(f["folder"]) if f["folder"] else None
            f["type"] = folder_type or _detect_type_by_name(f["name"])
            f["software"] = _get_software_label(p)
            all_models.append(f)
    return all_models


def discover_model_paths() -> list[dict]:
    """Auto-discover known AI model folders."""
    discovered: list[dict] = []
    local_app_data = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    user_home = Path.home()

    checks = [
        ("ComfyUI (Shared)", local_app_data / "Comfy-Desktop" / "ComfyUI-Shared" / "models"),
        ("ComfyUI (Portable)", user_home / "ComfyUI" / "models"),
        ("A1111 / Forge", user_home / "stable-diffusion-webui" / "models"),
        ("InvokeAI", user_home / "invokeai" / "models"),
        ("DiffusionBee", user_home / "DiffusionBee" / "models"),
        ("Fooocus", user_home / "Fooocus" / "models"),
        ("LTX Studio", user_home / "LTX Studio" / "models"),
        ("LTX Studio (Local)", local_app_data / "LTX Studio" / "models"),
    ]

    for label, path in checks:
        if path.exists():
            discovered.append({"label": label, "path": str(path)})

    # Check ComfyUI installs
    comfy_installs = local_app_data / "Comfy-Desktop" / "ComfyUI-Installs"
    if comfy_installs.exists():
        try:
            for entry in comfy_installs.iterdir():
                if entry.is_dir():
                    models_dir = entry / "ComfyUI" / "models"
                    if models_dir.exists():
                        discovered.append({"label": f"ComfyUI ({entry.name})", "path": str(models_dir)})
        except PermissionError:
            pass

    return discovered


def get_model_paths() -> list[str]:
    """Get saved custom model paths."""
    if MODEL_PATHS_FILE.exists():
        try:
            return json.loads(MODEL_PATHS_FILE.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return []


def set_model_paths(paths: list[str]) -> None:
    """Save custom model paths."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_PATHS_FILE.write_text(json.dumps(paths, indent=2))


def reveal_model(path: str) -> dict:
    """Open file explorer at the given path."""
    path_obj = Path(path)
    if not path_obj.exists():
        return {"success": False, "error": "File not found"}
    os.startfile(str(path_obj.parent))
    return {"success": True}


def delete_model(path: str) -> dict:
    """Move model file to trash."""
    path_obj = Path(path)
    if not path_obj.exists():
        return {"success": False, "error": "File not found"}
    try:
        send2trash.send2trash(str(path_obj))
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}
