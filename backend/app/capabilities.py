import enum
import json
import platform
import re
import subprocess
import sys
import time
from typing import Optional

import psutil


class GPUType(enum.Enum):
    NVIDIA = "nvidia"
    AMD = "amd"
    APPLE = "apple"
    INTEL = "intel"
    NONE = "none"


class CapabilityLevel(enum.IntEnum):
    NONE = 0
    MINIMAL = 1
    BASIC = 2
    STANDARD = 3
    HIGH = 4
    ULTRA = 5


CAPABILITY_NAMES = {
    CapabilityLevel.NONE: "CPU Only",
    CapabilityLevel.MINIMAL: "Minimal",
    CapabilityLevel.BASIC: "Basic",
    CapabilityLevel.STANDARD: "Standard",
    CapabilityLevel.HIGH: "High",
    CapabilityLevel.ULTRA: "Ultra",
}

_hardware_cache: dict = {}
_hardware_cache_time: float = 0
_HARDWARE_CACHE_TTL = 60  # seconds


def _run_nvidia_smi(*args: str) -> Optional[str]:
    try:
        r = subprocess.run(
            ["nvidia-smi", *args],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if r.returncode == 0:
            return r.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        pass
    return None


def _detect_nvidia_gpus() -> list[dict]:
    out = _run_nvidia_smi(
        "--query-gpu=index,name,memory.total,memory.free,driver_version",
        "--format=csv,noheader",
    )
    if not out:
        return []
    gpus = []
    for line in out.splitlines():
        parts = [p.strip() for p in line.split(", ")]
        if len(parts) >= 4:
            name = parts[1] if len(parts) > 1 else "Unknown"
            mem_total_str = parts[2] if len(parts) > 2 else "0 MiB"
            mem_free_str = parts[3] if len(parts) > 3 else "0 MiB"
            match_total = re.search(r"(\d+)", mem_total_str.replace(",", ""))
            match_free = re.search(r"(\d+)", mem_free_str.replace(",", ""))
            vram_total = int(match_total.group(1)) if match_total else 0
            vram_free = int(match_free.group(1)) if match_free else 0
            gpus.append({
                "index": int(parts[0]) if parts[0].isdigit() else 0,
                "name": name,
                "vram_total_mb": vram_total,
                "vram_free_mb": vram_free,
            })
    return gpus


def _detect_amd_gpus() -> list[dict]:
    try:
        r = subprocess.run(
            ["rocm-smi", "--showmeminfo", "vram", "--csv"],
            capture_output=True, text=True, timeout=5,
        )
        if r.returncode != 0:
            return []
        gpus = []
        for line in r.stdout.splitlines():
            if "VRAM" in line and "GB" in line:
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 3:
                    vram_total = float(parts[2].replace("GB", "").strip())
                    gpus.append({
                        "index": len(gpus),
                        "name": parts[1] if len(parts) > 1 else "AMD GPU",
                        "vram_total_mb": int(vram_total * 1024),
                        "vram_free_mb": 0,
                    })
        return gpus
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return []


def _detect_apple_silicon() -> bool:
    return sys.platform == "darwin" and platform.machine() == "arm64"


def _detect_pytorch() -> Optional[str]:
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
        return "cpu"
    except ImportError:
        return None


def _get_venv_info() -> dict:
    pip_list_cmd = [sys.executable, "-m", "pip", "list", "--format=json"]
    packages = []
    try:
        r = subprocess.run(pip_list_cmd, capture_output=True, text=True, timeout=10)
        if r.returncode == 0:
            packages = json.loads(r.stdout)
    except Exception:
        pass
    return {
        "python": sys.version.split()[0],
        "executable": sys.executable,
        "prefix": sys.prefix,
        "is_venv": sys.prefix != sys.base_prefix,
        "package_count": len(packages),
        "packages": packages,
    }


def detect_hardware(force: bool = False) -> dict:
    global _hardware_cache, _hardware_cache_time
    now = time.time()
    if not force and _hardware_cache and (now - _hardware_cache_time) < _HARDWARE_CACHE_TTL:
        return _hardware_cache

    gpu_type = GPUType.NONE
    gpus = []
    pytorch_backend = _detect_pytorch()

    nv_gpus = _detect_nvidia_gpus()
    if nv_gpus:
        gpu_type = GPUType.NVIDIA
        gpus = nv_gpus
    else:
        amd_gpus = _detect_amd_gpus()
        if amd_gpus:
            gpu_type = GPUType.AMD
            gpus = amd_gpus
        elif _detect_apple_silicon():
            gpu_type = GPUType.APPLE
            gpus = [{"index": 0, "name": "Apple Silicon (MPS)", "vram_total_mb": 0, "vram_free_mb": 0}]
        else:
            gpu_type = GPUType.NONE

    memory = psutil.virtual_memory()
    ram_gb = round(memory.total / (1024**3), 1)
    cpu_count = psutil.cpu_count(logical=True)

    vram_total_mb = max((g["vram_total_mb"] for g in gpus), default=0)

    if gpu_type == GPUType.APPLE:
        vram_total_mb = _get_apple_shared_memory_mb()

    level, features = _compute_capabilities(gpu_type, vram_total_mb, ram_gb)

    _hardware_cache = {
        "gpu_type": gpu_type.value,
        "gpus": gpus,
        "ram_gb": ram_gb,
        "cpu_count": cpu_count,
        "platform": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "python_version": sys.version.split()[0],
        "pytorch_backend": pytorch_backend,
        "capability_level": level.value,
        "capability_name": CAPABILITY_NAMES[level],
        "features": features,
        "all_features": _get_all_features_with_status(level),
        "venv": _get_venv_info(),
    }
    _hardware_cache_time = now
    return _hardware_cache


def _get_apple_shared_memory_mb() -> int:
    try:
        r = subprocess.run(
            ["sysctl", "-n", "hw.memsize"],
            capture_output=True, text=True, timeout=3,
        )
        if r.returncode == 0:
            total_bytes = int(r.stdout.strip())
            return int(total_bytes / (1024**2))
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError, ValueError):
        pass
    return 0


def _compute_capabilities(
    gpu_type: GPUType, vram_mb: int, ram_gb: float
) -> tuple[CapabilityLevel, list[str]]:
    features = []

    if gpu_type == GPUType.NVIDIA:
        vram_gb = vram_mb / 1024
        if vram_gb >= 24:
            level = CapabilityLevel.ULTRA
        elif vram_gb >= 12:
            level = CapabilityLevel.HIGH
        elif vram_gb >= 8:
            level = CapabilityLevel.STANDARD
        elif vram_gb >= 4:
            level = CapabilityLevel.BASIC
        else:
            level = CapabilityLevel.MINIMAL
    elif gpu_type == GPUType.AMD:
        vram_gb = vram_mb / 1024
        if vram_gb >= 24:
            level = CapabilityLevel.ULTRA
        elif vram_gb >= 16:
            level = CapabilityLevel.HIGH
        elif vram_gb >= 8:
            level = CapabilityLevel.STANDARD
        elif vram_gb >= 4:
            level = CapabilityLevel.BASIC
        else:
            level = CapabilityLevel.MINIMAL
    elif gpu_type == GPUType.APPLE:
        if ram_gb >= 32:
            level = CapabilityLevel.HIGH
        elif ram_gb >= 16:
            level = CapabilityLevel.STANDARD
        elif ram_gb >= 8:
            level = CapabilityLevel.BASIC
        else:
            level = CapabilityLevel.MINIMAL
    else:
        level = CapabilityLevel.NONE

    features.extend(_get_features_for_level(level))
    return level, features


def _get_features_for_level(level: CapabilityLevel) -> list[str]:
    all_features = [
        "text-generation",
        "text-to-image",
        "image-to-image",
        "lora-support",
        "controlnet",
        "inpainting",
        "video-generation",
        "audio-generation",
        "upscaling",
        "training",
        "real-time",
    ]
    level_thresholds: dict[str, CapabilityLevel] = {
        "text-generation": CapabilityLevel.NONE,
        "text-to-image": CapabilityLevel.MINIMAL,
        "image-to-image": CapabilityLevel.BASIC,
        "lora-support": CapabilityLevel.BASIC,
        "controlnet": CapabilityLevel.STANDARD,
        "inpainting": CapabilityLevel.BASIC,
        "video-generation": CapabilityLevel.HIGH,
        "audio-generation": CapabilityLevel.STANDARD,
        "upscaling": CapabilityLevel.STANDARD,
        "training": CapabilityLevel.ULTRA,
        "real-time": CapabilityLevel.ULTRA,
    }
    return [f for f in all_features if level >= level_thresholds.get(f, CapabilityLevel.NONE)]


def _get_all_features_with_status(level: CapabilityLevel) -> list[dict]:
    all_features = [
        ("text-generation", "none", None),
        ("text-to-image", "minimal", "GPU o CPU dedicada requerida"),
        ("image-to-image", "basic", "4+ GB VRAM requeridos"),
        ("lora-support", "basic", "4+ GB VRAM requeridos"),
        ("controlnet", "standard", "6+ GB VRAM recomendados"),
        ("inpainting", "basic", "4+ GB VRAM requeridos"),
        ("video-generation", "high", "12+ GB VRAM requeridos"),
        ("audio-generation", "standard", "6+ GB VRAM recomendados"),
        ("upscaling", "standard", "6+ GB VRAM recomendados"),
        ("training", "ultra", "24+ GB VRAM y GPU potente requeridos"),
        ("real-time", "ultra", "24+ GB VRAM y GPU potente requeridos"),
    ]
    level_thresholds: dict[str, CapabilityLevel] = {f[0]: CapabilityLevel[f[1].upper()] for f in all_features}
    return [
        {
            "name": f[0],
            "available": level >= level_thresholds[f[0]],
            "required_level": f[1],
            "reason": None if level >= level_thresholds[f[0]] else f[2],
        }
        for f in all_features
    ]
