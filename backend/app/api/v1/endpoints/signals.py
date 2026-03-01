"""Signal generation endpoints."""

from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from ....schemas.models import SignalsResponse
from ....services.signals import get_signal_service
from ....services.market_data import SIGNAL_UNIVERSE

router = APIRouter(prefix="/signals", tags=["Signals"])


@router.get("", response_model=SignalsResponse)
async def get_signals(
    horizon: int = Query(default=30, ge=5, le=90, description="Forecast horizon in days"),
    tickers: str = Query(
        default="",
        description="Comma-separated tickers (empty = full universe)",
    ),
):
    """
    Generate ranked buy/sell signals for the asset universe.

    Uses TimesFM's quantile forecasts to compute confidence-adjusted
    expected returns across the signal universe.
    """
    try:
        svc = get_signal_service()
        ticker_list = (
            [t.strip().upper() for t in tickers.split(",") if t.strip()]
            if tickers
            else None
        )
        signals = svc.generate_signals(tickers=ticker_list, horizon=horizon)
        return SignalsResponse(
            signals=signals,
            generated_at=datetime.utcnow().isoformat() + "Z",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
