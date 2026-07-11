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

## Estructura

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app, CORS, routers
│   ├── database.py              # SQLAlchemy engine + session
│   ├── models/
│   │   ├── __init__.py
│   │   └── api_key.py           # APIKey model (SQLAlchemy)
│   └── routers/
│       ├── __init__.py
│       ├── health.py            # GET /api/v1/health
│       ├── generation.py        # POST /api/v1/generate
│       └── api_keys.py          # CRUD api keys (Fernet encrypt)
├── .encryption_key              # Generado automáticamente si no existe
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

### `POST /api/v1/api-keys`

Guardar API key (cifrada con Fernet).

```json
{
  "service": "civitai",
  "key": "sk-..."
}
```

### `GET /api/v1/api-keys`

Listar servicios con API key configurada (sin revelar la key).

```json
[
  { "service": "civitai", "configured": true }
]
```

### `DELETE /api/v1/api-keys/{service}`

Eliminar API key de un servicio.

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

- [ ] Alembic migrations
- [ ] Endpoints reales de generación (integración con APIs de IA)
- [ ] Autenticación
- [ ] Modelos SQLAlchemy completos (Project, Generation, User)
