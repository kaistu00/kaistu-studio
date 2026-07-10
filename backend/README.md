# KAISTU Studio — Backend

> Python 3.14+ · FastAPI · SQLAlchemy · SQLite

## Stack

| Herramienta | Versión |
|-------------|---------|
| Python | 3.14+ |
| FastAPI | 0.115+ |
| Uvicorn | 0.34+ |
| SQLAlchemy | 2.0+ |
| SQLite | — |
| Pydantic | 2.10+ |
| HTTPX | 0.28+ |

## Estructura

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app, CORS, routers
│   ├── database.py              # SQLAlchemy engine + session
│   ├── models/                  # SQLAlchemy models
│   │   ├── __init__.py
│   │   └── ...
│   └── routers/
│       ├── __init__.py
│       ├── health.py            # GET /api/v1/health
│       └── generation.py        # POST /api/v1/generate
└── requirements.txt
```

## Endpoints

### `GET /`

Root. Health check básico.

```json
{ "service": "KAISTU Studio API", "version": "0.1.0", "status": "ok" }
```

### `GET /api/v1/health`

Health check detallado para el desktop.

```json
{ "status": "healthy", "service": "kaistu-studio-backend" }
```

### `POST /api/v1/generate`

Placeholder para generación con IA.

```json
{
  "prompt": "un gato volador",
  "mediaType": "image",
  "options": {}
}
```

### `GET /api/v1/projects`

Placeholder para listado de proyectos.

## CORS

Orígenes permitidos en desarrollo:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Next.js dev server)
- `file://` (Electron en producción)

## Desarrollo

```bash
# Crear entorno virtual
cd backend
py -m venv .venv
.venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Iniciar servidor (hot reload)
py -m uvicorn app.main:app --reload --port 8000

# Documentación interactiva
# http://127.0.0.1:8000/docs
# http://127.0.0.1:8000/redoc
```

## Próximos pasos

- [ ] Modelos SQLAlchemy completos (Project, Generation, User)
- [ ] Alembic migrations
- [ ] Endpoints reales de generación (integración con APIs de IA)
- [ ] Autenticación
