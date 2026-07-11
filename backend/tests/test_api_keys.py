"""Tests for the API keys endpoints."""

def test_list_api_keys_empty(client):
    resp = client.get("/api/v1/api-keys")
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_and_list_api_key(client):
    resp = client.post("/api/v1/api-keys", json={"service": "civitai", "api_key": "test-key-123"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["service"] == "civitai"

    resp = client.get("/api/v1/api-keys")
    assert resp.status_code == 200
    keys = resp.json()
    assert any(k["service"] == "civitai" for k in keys)


def test_delete_api_key(client):
    client.post("/api/v1/api-keys", json={"service": "huggingface", "api_key": "hf-test"})
    resp = client.delete("/api/v1/api-keys/huggingface")
    assert resp.status_code == 200

    resp = client.get("/api/v1/api-keys")
    assert not any(k["service"] == "huggingface" for k in resp.json())
