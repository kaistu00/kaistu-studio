"""Hugging Face Hub search tool."""

import logging
import os
from pathlib import Path

import httpx

logger = logging.getLogger("mcp.tools.huggingface")

HF_TOKEN_PATH = Path.home() / ".cache" / "huggingface" / "token"
HF_TOKEN = None
if HF_TOKEN_PATH.exists():
    HF_TOKEN = HF_TOKEN_PATH.read_text().strip()


def _normalize(s: str) -> str:
    return s.lower().replace(".", "").replace("_", "").replace("-", "").replace(" ", "")


async def _hf_get(path: str) -> dict | list:
    headers = {"Content-Type": "application/json"}
    if HF_TOKEN:
        headers["Authorization"] = f"Bearer {HF_TOKEN}"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"https://huggingface.co{path}", headers=headers)
        resp.raise_for_status()
        return resp.json()


def _build_secondary(data: list, exclude_id: str | None = None) -> list[dict]:
    return [
        {
            "id": d["id"],
            "downloads": d.get("downloads", 0),
            "likes": d.get("likes", 0),
            "pipeline_tag": d.get("pipeline_tag", ""),
            "author": d["id"].split("/")[0] if "/" in d["id"] else "",
        }
        for d in data
        if d["id"] != exclude_id
    ]


def _format_result(top: dict, detail: dict | None, data: list) -> dict:
    secondary = _build_secondary(data, top["id"])
    siblings = (detail or {}).get("siblings", [])
    files = [s["rfilename"] for s in siblings if isinstance(s, dict)]
    return {
        "primary": {
            "id": top["id"],
            "downloads": top.get("downloads", 0),
            "likes": top.get("likes", 0),
            "pipeline_tag": top.get("pipeline_tag", ""),
            "description": ((detail or {}).get("cardData", {}) or {}).get("description", ""),
            "tags": [(detail or {}).get("tags")] if (detail or {}).get("tags") else [],
            "author": top["id"].split("/")[0] if "/" in top["id"] else "",
            "safetensors": ((detail or {}).get("safetensors", {}) or {}).get("total"),
            "license": ((detail or {}).get("cardData", {}) or {}).get("license", ""),
            "files": [f for f in files if any(f.lower().endswith(ext) for ext in
                        [".safetensors", ".ckpt", ".gguf", ".pt", ".pth"])],
        },
        "secondary": secondary,
        "variants": [],
    }


async def search_hf_model(query: str) -> dict | None:
    """Search Hugging Face Hub for a model by filename.

    Uses multi-step matching: exact repo match by name+ext → exact by name only
    → file-level match → fallback returning all results as secondary.
    """
    logger.info("[search_hf_model] query: %s", query)
    try:
        ext_match = query.rsplit(".", 1)
        name = ext_match[0] if len(ext_match) > 1 and ext_match[1] else query
        name_with_ext = query
        norm_name_with_ext = _normalize(name_with_ext)
        norm_name = _normalize(name)

        # Step 1: search HF API
        data = await _hf_get(f"/api/models?search={name_with_ext}&limit=10")
        logger.info("[search_hf_model] got %d results", len(data) if isinstance(data, list) else 0)
        if not data or not isinstance(data, list) or len(data) == 0:
            logger.info("[search_hf_model] no results for query")
            return None

        # Step 2: exact repo id match (name+ext)
        for item in data:
            if item.get("id") and _normalize(item["id"]) == norm_name_with_ext:
                logger.info("[search_hf_model] exact match: %s", item["id"])
                detail = await _hf_get(f"/api/models/{item['id']}")
                return _format_result(item, detail, data)

        # Step 3: exact repo id match (name only)
        for item in data:
            if item.get("id") and _normalize(item["id"]) == norm_name:
                logger.info("[search_hf_model] partial match: %s", item["id"])
                detail = await _hf_get(f"/api/models/{item['id']}")
                return _format_result(item, detail, data)

        # Step 4: file-level match
        for item in data:
            try:
                detail = await _hf_get(f"/api/models/{item['id']}")
                if isinstance(detail, dict):
                    siblings = detail.get("siblings", [])
                    if any(s.get("rfilename") == name_with_ext for s in siblings if isinstance(s, dict)):
                        logger.info("[search_hf_model] file match in: %s", item["id"])
                        return _format_result(item, detail, data)
            except Exception:
                continue

        # Step 5: no exact match, return all as secondary
        logger.info("[search_hf_model] returning all as secondary")
        secondary = _build_secondary(data)
        return {"primary": None, "secondary": secondary, "variants": []}

    except Exception:
        return None
