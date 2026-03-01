"""Forecast endpoints — point + quantile forecasts with optional macro covariates."""

from fastapi import APIRouter, HTTPException
from ....schemas.models import ForecastRequest, ForecastResponse, QuantileForecast
from ....services.forecaster import get_forecast_service

router = APIRouter(prefix="/forecast", tags=["Forecast"])


@router.post("", response_model=ForecastResponse)
async def forecast_asset(req: ForecastRequest):
    """
    Generate a probabilistic price forecast for a single asset.

    Returns point forecast + 9 quantile bands (10th–90th percentile).
    Optionally augments the forecast with FRED macro covariates via TimesFM XReg.
    """
    try:
        svc = get_forecast_service()
        result = svc.forecast_asset(
            ticker=req.ticker,
            horizon=req.horizon,
            context_days=req.context_days,
            use_macro_covariates=req.use_macro_covariates,
            macro_series=req.macro_series if req.use_macro_covariates else None,
        )
        result["quantiles"] = QuantileForecast(**result["quantiles"])
        return ForecastResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast failed: {e}")
