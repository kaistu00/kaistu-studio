# KAISTU Studio — MCP Server

> Exposes all KAISTU Studio capabilities as MCP tools/resources for AI assistants (opencode, Claude Desktop, Cursor, etc.). **28 tools + 1 resource.**

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
│   ├── system.py        # CPU/RAM/GPU stats, caps, terminal execution
│   ├── backend.py       # Backend health, config, API keys, upscalers, executions, HF, Spaces, generation
│   ├── huggingface.py   # Hugging Face Hub search (local, no backend)
│   └── civitai.py       # Civitai search (local, no backend)
├── resources/
│   └── models.py        # Model list resource
├── requirements.txt
└── README.md
```

## Tools

### Models (4 local, 3 backend)

| Tool | Params | Loc/Backend | Description |
|------|--------|-------------|-------------|
| `scan_models` | `paths: string[]` | Backend | Scan directories for AI model files |
| `discover_model_paths` | — | Backend | Auto-discover known AI model folders |
| `get_model_paths` | — | Backend | Get saved custom model paths |
| `set_model_paths` | `paths: string[]` | Backend | Save custom model paths |
| `reveal_model` | `path: string` | **Local** | Open Explorer at model file location |
| `delete_model` | `path: string` | **Local** | Move model file to trash (send2trash) |

### System (2 local, 1 backend)

| Tool | Params | Loc/Backend | Description |
|------|--------|-------------|-------------|
| `get_system_stats` | — | **Local** | CPU %, RAM (used/total/percent), GPU(s) (name, utilization, memory) |
| `get_system_capabilities` | `force: bool = False` | Backend | Full hardware detection (GPU type, VRAM, CPU count, PyTorch backend, features, capability level) |
| `run_terminal` | `command: string` | **Local** | Execute shell command (30s timeout) |

### Backend Config & API Keys

| Tool | Params | Description |
|------|--------|-------------|
| `backend_health` | — | Check if local FastAPI backend is running |
| `get_config` | — | Read full `config.json` |
| `set_config` | `payload: dict` | Merge/update `config.json` |
| `list_api_keys` | — | List configured API key services (keys never returned) |
| `save_api_key` | `service, api_key` | Save/update API key (Fernet-encrypted) |
| `delete_api_key` | `service` | Delete API key |

### Upscalers (Real-ESRGAN)

| Tool | Params | Description |
|------|--------|-------------|
| `list_upscalers` | — | List all upscaler models with installation status |
| `install_upscaler` | `model_id: string` | Download and install an upscaler model (120s timeout) |
| `run_upscaler` | `model_id, payload` | Run upscale/clean/downscale/rescale. Payload: `mode` (required), `input_path`, `output_path`, `scale` (default 4), `face_enhance`, `target_width/height` (rescale), `params` (tile_size, gpu_id, tta) |

### Executions

| Tool | Params | Description |
|------|--------|-------------|
| `list_executions` | — | Last 50 executions (desc by started_at) |
| `get_execution` | `exec_id: string` | Single execution detail |
| `cancel_execution` | `exec_id: string` | Cancel pending/running execution |

### HuggingFace (2 local, 4 backend)

| Tool | Params | Loc/Backend | Description |
|------|--------|-------------|-------------|
| `search_huggingface` | `query: string` | **Local** | Search HF Hub for model (multi-step matching: exact repo → exact name → file-level → fallback) |
| `hf_text_leaderboard` | `limit: int = 10` | Backend | Top text-generation models by downloads |
| `hf_text_recommended` | `vram_gb: float = 8.0` / `limit` | Backend | Text-generation models recommended for VRAM |
| `get_space_info` | `space_id: string` | Backend | HF Space info + reliability stats |
| `run_space` | `space_id, payload` | Backend | Run inference on a HF Space (60s timeout) |

### Civitai (1 local)

| Tool | Params | Loc/Backend | Description |
|------|--------|-------------|-------------|
| `search_civitai` | `query: string` | **Local** | Search Civitai for model (exact normalized → includes → partial token ≥2 → fallback by downloads) |

### Generation

| Tool | Params | Description |
|------|--------|-------------|
| `generate` | `payload: dict` | Generate AI content (placeholder) |

## Resources

| URI | Description |
|-----|-------------|
| `kaistu://models/list` | All scanned models as JSON (`{models, count}`) |

## Architecture Notes

- **Local tools** (4): `reveal_model`, `delete_model`, `get_system_stats`, `run_terminal`, `search_huggingface`, `search_civitai` — run directly in the MCP process without backend dependency
- **Backend tools** (22): delegate to `http://127.0.0.1:8000/api/v1/...`
- **HF Auth**: if `~/.cache/huggingface/token` exists, it's used as Bearer token for HF Hub API calls

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
