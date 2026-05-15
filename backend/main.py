"""
Application entrypoint.

Startup order:
  1. Load .env / environment variables.
  2. If DATABASE_URL is set and RUN_MIGRATIONS=true, run Alembic migrations.
  3. If DATABASE_URL is set but no Alembic, create tables directly (fallback).
  4. Mount FastAPI app with all routes.
"""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import router
from src.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-8s %(name)s - %(message)s",
)
logger = logging.getLogger("sim_api")
logger.setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.database_url:
        logger.info("Database detected — ensuring tables exist...")
        from src.infrastructure.database import create_tables
        await create_tables()
        logger.info("Database ready.")
    else:
        logger.info("No DATABASE_URL — running in-memory (no persistence).")

    yield

    logger.info("Shutting down.")


app = FastAPI(
    title="Hex World Simulation API",
    description=(
        "Production-grade tile-based world simulation backend. "
        "Deterministic, event-driven, hex-grid simulation with "
        "influence matrices, spatial propagation, and full run replay."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log request start
    logger.info(f"Request started: {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        logger.info(
            f"Request finished: {request.method} {request.url.path} - "
            f"Status: {response.status_code} - "
            f"Time: {process_time:.2f}ms"
        )
        return response
    except Exception as e:
        process_time = (time.time() - start_time) * 1000
        logger.error(
            f"Request failed: {request.method} {request.url.path} - "
            f"Error: {str(e)} - "
            f"Time: {process_time:.2f}ms"
        )
        raise e


app.include_router(router)


@app.get("/health", tags=["Health"])
async def health():
    return {
        "status": "ok",
        "database": "connected" if settings.database_url else "in-memory",
    }
