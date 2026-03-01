"""Kairos API v1 router."""

from fastapi import APIRouter
from .endpoints import assets, forecast, signals, portfolio, patterns

router = APIRouter(prefix="/api/v1")

router.include_router(assets.router)
router.include_router(forecast.router)
router.include_router(signals.router)
router.include_router(portfolio.router)
router.include_router(patterns.router)
