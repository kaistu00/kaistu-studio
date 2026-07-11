# KAISTU Studio — MCP Server

> Exposes all KAISTU Studio capabilities as MCP tools/resources for AI assistants (opencode, Claude Desktop, Cursor, etc.).

## Stack

| Tool | Versión |
|------|---------|
| Python | 3.10+ |
| mcp | 1.x |
| httpx | 0.28+ |
| psutil | 6.1+ |
| send2trash | 1.8+ |

## Estructura

```
mcp-server/
├── main.py              # Entry point (stdio transport)
├── server.py            # FastMCP setup + tool/resource registration
├── tools/
│   ├── models.py        # Model scan, discover, reveal, delete
│   ├── system.py        # CPU/RAM/GPU stats, terminal execution
│   ├── backend.py       # Backend health, API keys CRUD
│   ├── huggingface.py   # Hugging Face Hub search
│   └── civitai.py       # Civitai search
├── resources/
│   └── models.py        # Model list resource
├── requirements.txt
└── README.md
```

## Tools

| Tool | Params | Description |
|------|--------|-------------|
| `scan_models` | `paths: string[]` | Scan directories for AI model files (safetensors, ckpt, gguf, pt, pth) |
| `discover_model_paths` | — | Auto-discover known AI model folders (ComfyUI, A1111, etc.) |
| `get_model_paths` | — | Get saved custom model paths |
| `set_model_paths` | `paths: string[]` | Save custom model paths |
| `reveal_model` | `path: string` | Open Explorer at model file location |
| `delete_model` | `path: string` | Move model file to trash |
| `get_system_stats` | — | CPU %, RAM, GPU utilization/memory |
| `run_terminal` | `command: string` | Execute shell command (30s timeout) |
| `backend_health` | — | Check if local FastAPI backend is running |
| `list_api_keys` | — | List configured API key services |
| `save_api_key` | `service, api_key` | Save/update API key (Fernet-encrypted) |
| `delete_api_key` | `service` | Delete API key |
| `search_huggingface` | `query: string` | Search HF Hub for model (multi-step matching) |
| `search_civitai` | `query: string` | Search Civitai for model (smart matching) |

## Resources

| URI | Description |
|-----|-------------|
| `kaistu://models/list` | All scanned models as JSON |

## Configuración

### opencode

Vía `opencode.jsonc` en la raíz del proyecto — se auto-registra:

```json
{
  "mcpServers": {
    "kaistu-studio": {
      "type": "stdio",
      "command": "py",
      "args": ["main.py"],
      "cwd": "${workspaceFolder}/mcp-server"
    }
  }
}
```

### Claude Desktop

```json
{
  "mcpServers": {
    "kaistu-studio": {
      "command": "py",
      "args": ["main.py"],
      "cwd": "C:/ruta/a/kaistu-studio/mcp-server"
    }
  }
}
```

### Cursor

Cursor detects `opencode.jsonc` automatically — no extra config needed.

## Desarrollo

```powershell
cd mcp-server
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Test with MCP Inspector
npx @modelcontextprotocol/inspector py main.py
```
