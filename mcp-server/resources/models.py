"""Model resources: expose scanned model data as MCP resources."""

import json

from tools.models import get_model_paths, scan_models


async def get_models_list() -> str:
    """Return all scanned models as JSON string."""
    paths = await get_model_paths()
    if not paths:
        return json.dumps({"models": [], "count": 0}, indent=2)
    models = await scan_models(paths)
    return json.dumps({"models": models, "count": len(models)}, indent=2)
