import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

_LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"


def _configure_logging():
    """Reconfigure logging AFTER uvicorn's own setup so our app loggers emit.

    Uvicorn applies logging.config.dictConfig during startup, which can leave
    child loggers (app.*) without an effective handler. This guarantees our
    traces reach stdout (captured by Electron) regardless of uvicorn's config.
    """
    root = logging.getLogger()
    for h in list(root.handlers):
        root.removeHandler(h)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_LOG_FORMAT))
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    for name in ("app", "app.routers", "app.routers.upscalers", "app.face_enhance", "app.routers.executions"):
        lg = logging.getLogger(name)
        lg.setLevel(logging.INFO)
        lg.propagate = True


logging.basicConfig(level=logging.INFO, format=_LOG_FORMAT)

from app.database import Base, engine, get_db
from app.models import api_key, upscaler, execution, runtime
from app.routers import health, generation, api_keys, system, models, search, config, upscalers, executions


@asynccontextmanager
async def lifespan(application: FastAPI):
    _configure_logging()
    Base.metadata.create_all(bind=engine)
    # Migrate existing DB: add default_scale if missing
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE upscalers ADD COLUMN default_scale INTEGER DEFAULT 4"))
            conn.commit()
    except Exception:
        pass
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE upscalers ADD COLUMN runtime_name VARCHAR"))
            conn.commit()
    except Exception:
        pass
    db = next(get_db())
    upscalers.seed_runtimes(db)
    upscalers.seed_upscalers(db)
    db.close()
    logging.info("[MAIN] KAISTU Studio API starting up")
    yield


app = FastAPI(
    title="KAISTU Studio API",
    version="0.1.0",
    description="Backend for the AI-powered content creation studio",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(generation.router, prefix="/api/v1", tags=["generation"])
app.include_router(api_keys.router, prefix="/api/v1", tags=["api-keys"])
app.include_router(system.router, prefix="/api/v1", tags=["system"])
app.include_router(models.router, prefix="/api/v1", tags=["models"])
app.include_router(search.router, prefix="/api/v1", tags=["search"])
app.include_router(config.router, prefix="/api/v1", tags=["config"])
app.include_router(upscalers.router, prefix="/api/v1", tags=["upscalers"])
app.include_router(executions.router, prefix="/api/v1", tags=["executions"])


@app.get("/")
async def root():
    return {"service": "KAISTU Studio API", "version": "0.1.0", "status": "ok"}

