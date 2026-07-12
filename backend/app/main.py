import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

from app.database import Base, engine
from app.routers import health, generation, api_keys, system, models, search, config


@asynccontextmanager
async def lifespan(application: FastAPI):
    Base.metadata.create_all(bind=engine)
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


@app.get("/")
async def root():
    return {"service": "KAISTU Studio API", "version": "0.1.0", "status": "ok"}

