from fastapi import APIRouter
import psutil

from app.capabilities import detect_hardware

try:
    import GPUtil
    GPU_AVAILABLE = True
except ImportError:
    GPU_AVAILABLE = False

router = APIRouter()

@router.get("/system-stats")
async def system_stats():
    # CPU usage
    cpu_percent = psutil.cpu_percent(interval=0.1)
    # Memory
    memory = psutil.virtual_memory()
    memory_total = memory.total
    memory_used = memory.used
    memory_percent = memory.percent

    # GPU
    gpus = []
    if GPU_AVAILABLE:
        try:
            gpus = GPUtil.getGPUs()
        except Exception:
            gpus = []

    gpu_list = []
    for gpu in gpus:
        gpu_list.append({
            "name": gpu.name,
            "utilization": gpu.load * 100,
            "memoryUsedMB": gpu.memoryUsed,
            "memoryTotalMB": gpu.memoryTotal,
        })

    return {
        "cpu": cpu_percent,
        "memory": {
            "usedGB": round(memory_used / (1024**3), 2),
            "totalGB": round(memory_total / (1024**3), 2),
            "percent": memory_percent,
        },
        "gpus": gpu_list,
    }


@router.get("/system/capabilities")
async def system_capabilities(force: bool = False):
    return detect_hardware(force=force)
