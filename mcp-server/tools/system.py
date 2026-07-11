"""System tools: CPU, RAM, GPU stats, terminal execution."""

import os
import platform
import subprocess

import psutil


def get_system_stats() -> dict:
    """Get CPU %, RAM, and GPU information."""
    cpu = psutil.cpu_percent(interval=0.5)
    mem = psutil.virtual_memory()
    memory = {
        "usedGB": round(mem.used / (1024**3), 2),
        "totalGB": round(mem.total / (1024**3), 2),
        "percent": mem.percent,
    }

    gpus = _get_gpu_info()

    return {"cpu": cpu, "memory": memory, "gpus": gpus}


def _get_gpu_info() -> list[dict]:
    """Collect GPU info via nvidia-smi and WMI."""
    gpus: list[dict] = []

    # Step 1: nvidia-smi
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total,name",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            for line in result.stdout.strip().split("\n"):
                if not line.strip():
                    continue
                parts = [p.strip() for p in line.split(", ")]
                gpus.append({
                    "name": parts[3] if len(parts) > 3 else "Unknown",
                    "utilization": float(parts[0]) if parts[0] else -1,
                    "memoryUsedMB": float(parts[1]) if len(parts) > 1 and parts[1] else 0,
                    "memoryTotalMB": float(parts[2]) if len(parts) > 2 and parts[2] else 0,
                })
    except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
        pass

    # Step 2: WMI for non-NVIDIA GPUs
    if platform.system() == "Windows":
        try:
            result = subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 "Get-CimInstance Win32_VideoController | Sort-Object PNPDeviceID | Select-Object Name, AdapterRAM | ConvertTo-Json -Compress"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0 and result.stdout.strip():
                import json
                raw = json.loads(result.stdout)
                wmi_gpus = raw if isinstance(raw, list) else [raw]
                known_names = {g["name"].lower() for g in gpus}
                for wmi in wmi_gpus:
                    name = wmi.get("Name")
                    if not name or name.lower() in known_names:
                        continue
                    gpus.append({
                        "name": name,
                        "utilization": -1,
                        "memoryUsedMB": 0,
                        "memoryTotalMB": round((wmi.get("AdapterRAM", 0) or 0) / (1024 * 1024)),
                    })
        except (subprocess.TimeoutExpired, subprocess.SubprocessError, json.JSONDecodeError):
            pass

    return gpus


def run_terminal(command: str) -> dict:
    """Execute a shell command and return stdout/stderr."""
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exitCode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Command timed out after 30s", "exitCode": -1}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "exitCode": -1}
