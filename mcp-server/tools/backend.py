"""Backend tools: health check, API keys CRUD, generation."""

import httpx

BACKEND_URL = "http://127.0.0.1:8000"


async def _fetch(path: str, method: str = "GET", body: dict | None = None) -> dict | list:
    url = f"{BACKEND_URL}/api/v1{path}"
    async with httpx.AsyncClient(timeout=5) as client:
        if method == "GET":
            resp = await client.get(url, headers={"Content-Type": "application/json"})
        elif method == "POST":
            resp = await client.post(url, json=body, headers={"Content-Type": "application/json"})
        elif method == "DELETE":
            resp = await client.delete(url, headers={"Content-Type": "application/json"})
        else:
            raise ValueError(f"Unsupported method: {method}")
        resp.raise_for_status()
        return resp.json()


async def backend_health() -> dict:
    """Check if the Python backend is running."""
    try:
        result = await _fetch("/health")
        return {"status": "healthy", "service": "kaistu-studio-backend", "detail": result}
    except Exception as e:
        return {"status": "unreachable", "error": str(e)}


async def list_api_keys() -> list[dict]:
    """List configured API key services (keys are never returned in plaintext)."""
    try:
        result = await _fetch("/api-keys")
        return result if isinstance(result, list) else []
    except Exception as e:
        return [{"error": str(e)}]


async def save_api_key(service: str, api_key: str) -> dict:
    """Save or update an API key for a service (encrypted via Fernet on the backend)."""
    try:
        result = await _fetch("/api-keys", method="POST", body={"service": service, "api_key": api_key})
        return result if isinstance(result, dict) else {"service": service}
    except Exception as e:
        return {"error": str(e)}


async def delete_api_key(service: str) -> dict:
    """Delete an API key for a service."""
    try:
        result = await _fetch(f"/api-keys/{service}", method="DELETE")
        return result if isinstance(result, dict) else {"deleted": service}
    except Exception as e:
        return {"error": str(e)}
