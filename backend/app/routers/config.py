import json
import os
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

_CONFIG_FILE = os.path.join(
    os.environ.get("APPDATA", os.path.expanduser("~")),
    "kaistu-studio",
    "config.json",
)


def _load_config() -> dict:
    try:
        if os.path.exists(_CONFIG_FILE):
            return json.loads(Path(_CONFIG_FILE).read_text())
    except (OSError, json.JSONDecodeError):
        pass
    return {}


def _save_config(cfg: dict) -> None:
    os.makedirs(os.path.dirname(_CONFIG_FILE), exist_ok=True)
    current = _load_config()
    current.update(cfg)
    Path(_CONFIG_FILE).write_text(json.dumps(current, indent=2))


@router.get("/config")
async def get_config():
    return _load_config()


@router.post("/config")
async def set_config(payload: dict):
    _save_config(payload)
    return {"saved": True}
