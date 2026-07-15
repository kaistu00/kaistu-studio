# KAISTU Studio — Backend

> Python 3.14+ · FastAPI · SQLAlchemy · SQLite · **33 endpoints**

## Stack

| Herramienta | Versión |
|-------------|---------|
| Python | 3.14+ |
| FastAPI | 0.115+ |
| Uvicorn | 0.34+ |
| SQLAlchemy | 2.0+ |
| SQLite | — |
| Pydantic | 2.10+ |

## Estructura

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app, CORS, routers
│   ├── database.py              # SQLAlchemy engine + session
│   ├── models/
│   │   ├── __init__.py
│   │   └── api_key.py           # APIKey SQLAlchemy model
│   ├── execution.py             # Execution model (dataclass + JSON file store)
│   └── routers/
│       ├── __init__.py
│       ├── health.py            # GET  /api/v1/health
│       ├── generation.py        # POST /api/v1/generate, GET /api/v1/projects
│       ├── api_keys.py          # CRUD /api/v1/api-keys (Fernet encrypt)
│       ├── system.py            # POST /api/v1/log, GET /api/v1/system-stats, GET /api/v1/system/capabilities
│       ├── models.py            # CRUD /api/v1/models/{paths,discover,scan,delete,download}, HF endpoints, Spaces
│       ├── search.py            # GET /api/v1/search/huggingface, GET /api/v1/search/civitai
│       ├── config.py            # GET+POST /api/v1/config
│       ├── upscalers.py         # GET /api/v1/upscalers, POST /api/v1/upscalers/{id}/{install,run}
│       └── executions.py        # GET /api/v1/executions, GET/POST/DELETE /api/v1/executions/{id}
├── .encryption_key              # Generado automáticamente si no existe
└── requirements.txt
```

## Endpoints

### Root

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Health check básico → `{service, version, status}` |

### Health

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Health check detallado → `{status, service}` |

### Generation

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/v1/generate` | Placeholder IA generation |
| `GET` | `/api/v1/projects` | Placeholder list projects |

### API Keys (Fernet-encrypted)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/v1/api-keys` | Guardar/actualizar API key (upsert) |
| `GET` | `/api/v1/api-keys` | Listar servicios configurados (sin revelar key) |
| `DELETE` | `/api/v1/api-keys/{service}` | Eliminar API key |

### System

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/v1/log` | Centralized logging from Electron/MCP |
| `GET` | `/api/v1/system-stats` | CPU %, RAM (used/total/percent), GPU(s) con nombre/utilización/memoria |
| `GET` | `/api/v1/system/capabilities` | Detección completa hardware (GPU, VRAM, features, PyTorch backend, venv). Parámetro opcional `?force=true` |

### Models

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/models/paths` | Obtener rutas guardadas de escaneo |
| `POST` | `/api/v1/models/paths` | Guardar rutas de escaneo |
| `GET` | `/api/v1/models/discover` | Auto-descubrir carpetas (ComfyUI, A1111, etc.) |
| `POST` | `/api/v1/models/scan` | Escanear directorios en busca de modelos (safetensors, ckpt, gguf, pt, pth) |
| `POST` | `/api/v1/models/delete` | Eliminar archivo de modelo del disco |
| `POST` | `/api/v1/models/download` | Descargar modelo (soporta auth Civitai) |

### HuggingFace

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/models/hf-text-leaderboard?limit=10` | Top modelos text-generation por descargas |
| `GET` | `/api/v1/models/hf-text-recommended?vram_gb=8.0&limit=10` | Modelos text-generation recomendados para VRAM disponible |
| `GET` | `/api/v1/spaces/info/{space_id}` | Info de un HF Space (runtime, confiabilidad) |
| `POST` | `/api/v1/spaces/{space_id}` | Ejecutar inferencia en un HF Space via MCP endpoint |

### Search

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/search/huggingface?q=...` | Buscar modelos en HuggingFace Hub |
| `GET` | `/api/v1/search/civitai?q=...&nsfw=false` | Buscar modelos en Civitai |

### Config

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/config` | Leer `config.json` completo |
| `POST` | `/api/v1/config` | Fusionar/actualizar `config.json` |

### Upscalers (Real-ESRGAN)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/upscalers` | Listar modelos upscaler con estado de instalación |
| `POST` | `/api/v1/upscalers/{model_id}/install` | Descargar e instalar modelo upscaler |
| `POST` | `/api/v1/upscalers/{model_id}/run` | Ejecutar upscale/clean/downscale/rescale en imagen/video. Parámetros: `input_path`, `output_path`, `mode`, `scale`, `face_enhance`, `params` (tile_size, gpu_id, tta), `target_width/height` (modo rescale). Auto-descarga binarios en primer uso. |

### Executions

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/executions` | Últimas 50 ejecuciones (orden descendente) |
| `GET` | `/api/v1/executions/stats` | Estadísticas: total, completed, running, failed |
| `GET` | `/api/v1/executions/{exec_id}` | Detalle de ejecución individual |
| `POST` | `/api/v1/executions/start` | Crear nueva ejecución pendiente |
| `POST` | `/api/v1/executions/{exec_id}/progress` | Actualizar progreso/estado de ejecución |
| `DELETE` | `/api/v1/executions/{exec_id}` | Cancelar ejecución pendiente/en curso (kills process) |

## CORS

Orígenes permitidos en desarrollo:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Next.js dev server)

## Seguridad

- API keys cifradas con Fernet (symmetric encryption)
- Clave almacenada en `.encryption_key` si no se provee `ENCRYPTION_KEY` env var
- Las keys nunca se devuelven en texto plano en respuestas

## Desarrollo

```bash
cd backend
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
py -m uvicorn app.main:app --reload --port 8000
# Documentación interactiva: http://127.0.0.1:8000/docs
```

## Próximos pasos

- [ ] Alembic migrations
- [ ] Endpoints reales de generación (integración con APIs de IA)
- [ ] Autenticación
- [ ] Modelos SQLAlchemy completos (Project, Generation, User)
