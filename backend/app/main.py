"""Kairos FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1 import router as api_v1_router
from .core.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger("kairos")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up the TimesFM model at startup so the first request is fast."""
    logger.info("Kairos starting up — warming TimesFM model…")
    try:
        from .core.model import get_timesfm_model
        get_timesfm_model()
        logger.info("TimesFM model ready.")
    except Exception as e:
        logger.error(f"Model warm-up failed: {e}. Will retry on first request.")
    yield
    logger.info("Kairos shutting down.")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Kairos — Macro-Aware Probabilistic Portfolio Intelligence",
        description=(
            "AI-powered investment research platform built on TimesFM 2.5. "
            "Provides probabilistic asset forecasts, macro-augmented signals, "
            "portfolio VaR/CVaR, and the Temporal Pattern Library."
        ),
        version="1.0.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_v1_router)

    @app.get("/health", tags=["Health"])
    async def health():
        return {"status": "ok", "service": "kairos-backend"}

    return app


app = create_app()
