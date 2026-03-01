"""Asset & macro data endpoints."""

from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from ....schemas.models import AssetHistoryResponse, MacroSeriesResponse, MacroSnapshot
from ....services.market_data import get_market_data_service, SIGNAL_UNIVERSE, FRED_SERIES
import numpy as np

router = APIRouter(prefix="/assets", tags=["Market Data"])


@router.get("/universe")
async def get_universe():
    """Return the full signal universe with metadata."""
    return {
        ticker: meta
        for ticker, meta in SIGNAL_UNIVERSE.items()
        if not ticker.startswith("^")
    }


@router.get("/macro/series")
async def list_macro_series():
    """List available FRED macro series."""
    return FRED_SERIES


@router.get("/macro/snapshot", response_model=MacroSnapshot)
async def get_macro_snapshot():
    """Return latest values for key macro indicators."""
    svc = get_market_data_service()
    snap = svc.get_macro_snapshot()
    return MacroSnapshot(
        yield_curve_slope=snap.get("T10Y2Y"),
        vix=snap.get("VIXCLS"),
        cpi_yoy=snap.get("CPIAUCSL"),
        unemployment_rate=snap.get("UNRATE"),
        fed_funds_rate=snap.get("FEDFUNDS"),
        credit_spread_hy=snap.get("BAMLH0A0HYM2"),
        updated_at=datetime.utcnow().isoformat(),
    )


@router.get("/{ticker}/history", response_model=AssetHistoryResponse)
async def get_asset_history(
    ticker: str,
    days: int = Query(default=252, ge=30, le=1260),
):
    """Return OHLCV history and log-returns for a ticker."""
    try:
        svc = get_market_data_service()
        closes = svc.get_close_series(ticker.upper(), days=days)
        if closes.empty:
            raise HTTPException(status_code=404, detail=f"No data for {ticker}")

        log_ret = np.diff(np.log(closes.values)).tolist()
        log_ret = [0.0] + log_ret  # pad to same length

        return AssetHistoryResponse(
            ticker=ticker.upper(),
            dates=[d.strftime("%Y-%m-%d") for d in closes.index],
            close=closes.values.tolist(),
            volume=[0.0] * len(closes),  # simplified
            returns=[round(r, 6) for r in log_ret],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/macro/{series_id}", response_model=MacroSeriesResponse)
async def get_macro_series(
    series_id: str,
    days: int = Query(default=756, ge=30, le=3650),
):
    """Fetch a FRED macro time series."""
    try:
        svc = get_market_data_service()
        series = svc.get_macro_series(series_id.upper(), days=days)
        if series.empty:
            raise HTTPException(
                status_code=404,
                detail=f"No data for FRED series {series_id}. Check FRED_API_KEY.",
            )
        return MacroSeriesResponse(
            series_id=series_id.upper(),
            name=FRED_SERIES.get(series_id.upper(), series_id),
            dates=[d.strftime("%Y-%m-%d") for d in series.index],
            values=series.values.tolist(),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
