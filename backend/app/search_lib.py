"""Server-side Hugging Face and Civitai search proxies.

Ported from the Electron main process so the web frontend can reach these
external services (including the local HF token) over HTTP.
"""
import os
import re
from pathlib import Path

import httpx


def _hf_token() -> str | None:
    token_path = Path(os.path.expanduser("~")) / ".cache" / "huggingface" / "token"
    try:
        if token_path.exists():
            return token_path.read_text().strip() or None
    except OSError:
        pass
    return None


def _normalize(s: str) -> str:
    return s.lower().replace("_", "").replace(".", "").replace("-", "").replace(" ", "")


async def search_hf(query: str) -> dict | None:
    token = _hf_token()
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    name_with_ext = query
    ext_match = re.match(r"^(.+?)\.([^.]+)$", query)
    name = ext_match.group(1) if ext_match else query
    norm_name_with_ext = _normalize(name_with_ext)
    norm_name = _normalize(name)

    async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
        resp = await client.get(
            "https://huggingface.co/api/models",
            params={"search": name_with_ext, "limit": 10},
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if not data:
            return None

        def build_secondary(exclude_id: str | None = None) -> list[dict]:
            return [
                {
                    "id": d["id"],
                    "downloads": d.get("downloads", 0),
                    "likes": d.get("likes", 0),
                    "pipeline_tag": d.get("pipeline_tag", ""),
                    "description": "",
                    "tags": [],
                    "author": d["id"].split("/")[0] if d.get("id") else "",
                    "safetensors": None,
                    "license": "",
                }
                for d in data
                if d.get("id") != exclude_id
            ]

        def format_result(top: dict, detail: dict) -> dict:
            return {
                "primary": {
                    "id": top["id"],
                    "downloads": top.get("downloads", 0),
                    "likes": top.get("likes", 0),
                    "pipeline_tag": top.get("pipeline_tag", ""),
                    "description": detail.get("cardData", {}).get("description")
                    or detail.get("cardData", {}).get("summary", ""),
                    "tags": [
                        t if isinstance(t, str) else str(t)
                        for t in (detail.get("tags") or [])
                    ],
                    "author": top["id"].split("/")[0] if top.get("id") else "",
                    "safetensors": detail.get("safetensors", {}).get("total"),
                    "license": detail.get("cardData", {}).get("license", ""),
                    "files": [
                        s["rfilename"]
                        for s in detail.get("siblings", [])
                        if s.get("rfilename", "").lower().endswith((".safetensors", ".ckpt", ".gguf", ".pt", ".pth"))
                    ],
                },
                "secondary": build_secondary(top.get("id")),
                "variants": [],
            }

        found: dict | None = next((d for d in data if d.get("id") and _normalize(d["id"]) == norm_name_with_ext), None)
        if found:
            detail = (await client.get(f"https://huggingface.co/api/models/{found['id']}")).json()
            return format_result(found, detail)

        found = next((d for d in data if d.get("id") and _normalize(d["id"]) == norm_name), None)
        if found:
            detail = (await client.get(f"https://huggingface.co/api/models/{found['id']}")).json()
            return format_result(found, detail)

        for d in data:
            try:
                detail = (await client.get(f"https://huggingface.co/api/models/{d['id']}")).json()
            except Exception:
                continue
            files = [s.get("rfilename") for s in detail.get("siblings", [])]
            if name_with_ext in files:
                return format_result(d, detail)

        return {"primary": None, "secondary": build_secondary(), "variants": []}


async def search_civitai(query: str, nsfw: bool = False) -> dict | None:
    norm_query = _normalize(query)
    async with httpx.AsyncClient(timeout=8.0) as client:
        resp = await client.get(
            "https://civitai.com/api/v1/models",
            params={"limit": 10, "query": query, "nsfw": nsfw},
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        items = data.get("items") or []
        if not items:
            return None

        best: dict | None = None
        best_score = -1
        for item in items:
            norm_name = _normalize(item.get("name", ""))
            if norm_name == norm_query:
                best = item
                best_score = 3
                break
            if norm_query in norm_name or norm_name in norm_query:
                if best_score < 2:
                    best = item
                    best_score = 2
                continue
            q_words = [w for w in norm_query.split() if w] + (norm_query.split() or [])
            n_words = [w for w in norm_name.split() if w]
            matches = [w for w in q_words if any(w in n for n in n_words)]
            if len(matches) >= 2 and best_score < 1:
                best = item
                best_score = 1

        if not best:
            best = max(items, key=lambda a: a.get("downloadCount", 0))

        return {
            "primary": best,
            "secondary": [i for i in items if i.get("id") != best.get("id")],
        }