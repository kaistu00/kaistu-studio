from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, generation, api_keys

app = FastAPI(
    title="KAISTU Studio API",
    version="0.1.0",
    description="Backend for the AI-powered content creation studio",
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


@app.get("/")
async def root():
    return {"service": "KAISTU Studio API", "version": "0.1.0", "status": "ok"}
