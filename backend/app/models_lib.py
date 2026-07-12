"""Server-side model scanning/discovery logic.

Ported from the Electron main process so the web frontend can scan models
over HTTP. Kept self-contained to avoid coupling with the desktop runtime.
"""
import os
from pathlib import Path

MODEL_EXTENSIONS = {
    ".ckpt", ".safetensors", ".pt", ".pth", ".bin",
    ".vae.pt", ".vae.safetensors", ".patch", ".gguf", ".gguf_model",
}

FOLDER_TYPE_MAP = {
    "checkpoint": "checkpoint",
    "checkpoints": "checkpoint",
    "diffusion_models": "checkpoint",
    "stable-diffusion": "checkpoint",
    "lora": "lora",
    "loras": "lora",
    "lycoris": "lora",
    "vae": "vae",
    "vaes": "vae",
    "clip": "clip",
    "clips": "clip",
    "clip_vision": "clip_vision",
    "text_encoder": "text_encoder",
    "text_encoders": "text_encoder",
    "controlnet": "controlnet",
    "controlnets": "controlnet",
    "cnet": "controlnet",
    "upscaler": "upscaler",
    "upscalers": "upscaler",
    "upscale_models": "upscaler",
    "embedding": "embedding",
    "embeddings": "embedding",
    "unet": "unet",
    "unets": "unet",
    "gligen": "gligen",
    "style_model": "style_model",
    "style_models": "style_model",
    "hypernetwork": "hypernetwork",
    "hypernetworks": "hypernetwork",
    "inpaint": "inpaint",
}

SKIP_DIRS = {
    "node_modules", ".git", ".svn", "__pycache__",
    "temp", "tmp", "logs", "log", ".npm", ".yarn", ".pnpm",
    "Microsoft", "Windows", "WinSxS", "System32", "SysWOW64",
    "Intel", "AMD", "NVIDIA", "Package Cache", "Installer",
    "Common Files", "Internet Explorer", "MSBuild",
}


def is_model_file(name: str) -> bool:
    lower = name.lower()
    return any(lower.endswith(ext) for ext in MODEL_EXTENSIONS)


def detect_type_by_folder(folder: str) -> str | None:
    lower = folder.lower().replace(" ", "_").replace("-", "_")
    segments = lower.split("/")
    for seg in segments:
        normalized = seg.rstrip("_")
        for key, val in FOLDER_TYPE_MAP.items():
            if normalized == key or normalized == key.replace("_", ""):
                return val
    return None


def detect_type_by_name(name: str) -> str:
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


def get_parent_folder_name(file_path: str, root_dir: str) -> str:
    rel = file_path[len(root_dir):].lstrip("/\\")
    parts = Path(rel).parts[:-1]
    return "/".join(parts)


def scan_directory(dir_path: str) -> list[dict]:
    results: list[dict] = []

    def walk(d: str, depth: int):
        if depth > 5:
            return
        try:
            for entry in os.scandir(d):
                full = os.path.join(d, entry.name)
                if entry.is_dir():
                    walk(full, depth + 1)
                elif entry.is_file() and is_model_file(entry.name):
                    try:
                        size_mb = os.path.getsize(full) / (1024 * 1024)
                        folder = get_parent_folder_name(full, dir_path)
                        results.append({
                            "name": entry.name,
                            "path": full,
                            "type": "",
                            "sizeMB": size_mb,
                            "folder": folder,
                        })
                    except OSError:
                        pass
        except (OSError, PermissionError):
            pass

    walk(dir_path, 0)
    return results


def has_model_files(dir_path: str) -> bool:
    try:
        for entry in os.scandir(dir_path):
            if entry.is_file() and is_model_file(entry.name):
                return True
    except (OSError, PermissionError):
        pass
    try:
        for entry in os.scandir(dir_path):
            if not entry.is_dir():
                continue
            try:
                for sub in os.scandir(entry.path):
                    if sub.is_file() and is_model_file(sub.name):
                        return True
                    if sub.is_dir():
                        try:
                            for sub2 in os.scandir(sub.path):
                                if sub2.is_file() and is_model_file(sub2.name):
                                    return True
                        except (OSError, PermissionError):
                            pass
            except (OSError, PermissionError):
                pass
    except (OSError, PermissionError):
        pass
    return False


def find_models_folders(root_path: str, max_depth: int) -> list[dict]:
    results: list[dict] = []
    seen: set[str] = set()

    def walk(d: str, depth: int):
        if depth > max_depth:
            return
        try:
            for entry in os.scandir(d):
                full = os.path.join(d, entry.name)
                if not entry.is_dir():
                    continue
                if entry.name in SKIP_DIRS:
                    continue
                normalized = full.lower()
                if normalized in seen:
                    continue
                seen.add(normalized)
                if entry.name.lower() == "models":
                    results.append({"label": os.path.basename(d) or d, "path": full})
                else:
                    walk(full, depth + 1)
        except (OSError, PermissionError):
            pass

    walk(root_path, 0)
    return results


_DISCOVER_ROOTS: list[tuple[str, int]] = []


def init_discover_roots() -> None:
    if _DISCOVER_ROOTS:
        return
    local_app_data = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Local")
    app_data = os.environ.get("APPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Roaming")
    home = os.path.expanduser("~")

    _DISCOVER_ROOTS.append((local_app_data, 4))
    if app_data != local_app_data:
        _DISCOVER_ROOTS.append((app_data, 4))
    _DISCOVER_ROOTS.append((home, 3))

    prog_data = os.environ.get("PROGRAMDATA") or "C:\\ProgramData"
    if os.path.exists(prog_data):
        _DISCOVER_ROOTS.append((prog_data, 3))
    prog_files = os.environ.get("PROGRAMFILES") or "C:\\Program Files"
    if os.path.exists(prog_files):
        _DISCOVER_ROOTS.append((prog_files, 3))
    prog_files_x86 = os.environ.get("PROGRAMFILES(X86)") or "C:\\Program Files (x86)"
    if os.path.exists(prog_files_x86) and prog_files_x86 != prog_files:
        _DISCOVER_ROOTS.append((prog_files_x86, 3))


def get_software_label_from_path(models_path: str) -> str:
    lower = models_path.lower()
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
    return os.path.basename(os.path.dirname(models_path)) or "Modelos"


def discover_model_paths() -> list[dict]:
    discovered: list[dict] = []
    local_app_data = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Local")
    home = os.path.expanduser("~")

    comfy_desktop = os.path.join(local_app_data, "Comfy-Desktop")
    comfy_shared = os.path.join(comfy_desktop, "ComfyUI-Shared", "models")
    if os.path.exists(comfy_shared):
        discovered.append({"label": "ComfyUI (Shared)", "path": comfy_shared})
    comfy_installs = os.path.join(comfy_desktop, "ComfyUI-Installs")
    if os.path.exists(comfy_installs):
        try:
            for entry in os.scandir(comfy_installs):
                if entry.is_dir():
                    models_dir = os.path.join(comfy_installs, entry.name, "ComfyUI", "models")
                    if os.path.exists(models_dir):
                        discovered.append({"label": f"ComfyUI ({entry.name})", "path": models_dir})
        except (OSError, PermissionError):
            pass
    comfy_portable = os.path.join(home, "ComfyUI", "models")
    if os.path.exists(comfy_portable):
        discovered.append({"label": "ComfyUI (Portable)", "path": comfy_portable})
    sd_base = os.path.join(home, "stable-diffusion-webui", "models")
    if os.path.exists(sd_base):
        discovered.append({"label": "A1111 / Forge", "path": sd_base})
    invoke_dir = os.path.join(home, "invokeai", "models")
    if os.path.exists(invoke_dir):
        discovered.append({"label": "InvokeAI", "path": invoke_dir})
    bee_dir = os.path.join(home, "DiffusionBee", "models")
    if os.path.exists(bee_dir):
        discovered.append({"label": "DiffusionBee", "path": bee_dir})
    fooocus_dir = os.path.join(home, "Fooocus", "models")
    if os.path.exists(fooocus_dir):
        discovered.append({"label": "Fooocus", "path": fooocus_dir})
    ltx_dir = os.path.join(home, "LTX Studio", "models")
    if os.path.exists(ltx_dir):
        discovered.append({"label": "LTX Studio", "path": ltx_dir})
    ltx_local = os.path.join(local_app_data, "LTX Studio", "models")
    if os.path.exists(ltx_local):
        discovered.append({"label": "LTX Studio", "path": ltx_local})
    ltx_programs = os.path.join(local_app_data, "Programs", "LTX Studio", "models")
    if os.path.exists(ltx_programs):
        discovered.append({"label": "LTX Studio", "path": ltx_programs})

    init_discover_roots()
    seen: set[str] = set()
    for root, depth in _DISCOVER_ROOTS:
        if not os.path.exists(root):
            continue
        for f in find_models_folders(root, depth):
            if f["path"] in seen:
                continue
            seen.add(f["path"])
            if not any(d["path"] == f["path"] for d in discovered):
                discovered.append(f)
    return discovered


def scan_models(sources: list[dict]) -> list[dict]:
    all_models: list[dict] = []
    for src in sources:
        path = src.get("path")
        if path and os.path.exists(path):
            for f in scan_directory(path):
                folder_type = detect_type_by_folder(f["folder"]) if f["folder"] else None
                mtype = folder_type or detect_type_by_name(f["name"])
                all_models.append({
                    "name": f["name"],
                    "path": f["path"],
                    "type": mtype,
                    "sizeMB": f["sizeMB"],
                    "software": src.get("label") or get_software_label_from_path(f["path"]),
                })
    return all_models
