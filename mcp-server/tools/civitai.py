"""Civitai search tool."""

import httpx


def _normalize(s: str) -> str:
    return s.lower().replace(".", "").replace("_", "").replace("-", "").replace(" ", "")


async def search_civitai_model(query: str) -> dict | None:
    """Search Civitai for a model by name.

    Matching strategy: exact normalized → includes → partial word match (≥2 words)
    → fallback by highest download count.
    """
    try:
        norm_query = _normalize(query)
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://civitai.com/api/v1/models?limit=10&query={query}",
            )
            if resp.status_code != 200:
                return None
            data = resp.json()

        items = data.get("items", [])
        if not items:
            return None

        best = None
        best_score = -1

        for item in items:
            norm_name = _normalize(item.get("name", ""))
            if norm_name == norm_query:
                best = item
                best_score = 3
                break
            if norm_name in norm_query or norm_query in norm_name:
                if best_score < 2:
                    best = item
                    best_score = 2
                continue
            # Partial word match: at least 2 tokens
            import re
            query_tokens = [t for t in re.split(r"[\d\s_-]+", norm_query) if t]
            name_tokens = [t for t in re.split(r"[\d\s_-]+", norm_name) if t]
            matches = sum(1 for qt in query_tokens if any(qt in nt for nt in name_tokens))
            if matches >= 2 and best_score < 1:
                best = item
                best_score = 1

        if not best:
            best = max(items, key=lambda x: x.get("downloadCount", 0) or 0)

        def _format_primary(p: dict) -> dict:
            versions = p.get("modelVersions", [])
            return {
                "id": p.get("id"),
                "name": p.get("name"),
                "type": p.get("type"),
                "nsfw": p.get("nsfw", False),
                "description": p.get("description", ""),
                "tags": p.get("tags", []),
                "downloadCount": p.get("downloadCount", 0),
                "thumbsUpCount": p.get("thumbsUpCount", 0),
                "creator": p.get("creator", {}),
                "modelVersions": [
                    {
                        "id": v.get("id"),
                        "name": v.get("name"),
                        "downloadUrl": v.get("downloadUrl"),
                        "files": v.get("files", []),
                        "baseModel": v.get("baseModel"),
                    }
                    for v in versions
                ],
            }

        return {
            "primary": _format_primary(best),
            "secondary": [
                {"id": i.get("id"), "name": i.get("name"), "type": i.get("type")}
                for i in items if i.get("id") != best.get("id")
            ],
        }

    except Exception:
        return None
