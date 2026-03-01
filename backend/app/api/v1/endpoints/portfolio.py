"""Portfolio risk endpoints."""

from fastapi import APIRouter, HTTPException
from ....schemas.models import PortfolioRiskRequest, PortfolioRiskResponse
from ....services.risk import get_risk_service

router = APIRouter(prefix="/portfolio", tags=["Portfolio Risk"])


@router.post("/risk", response_model=PortfolioRiskResponse)
async def compute_portfolio_risk(req: PortfolioRiskRequest):
    """
    Compute portfolio-level risk metrics from TimesFM quantile forecasts.

    Returns VaR, CVaR, expected return, worst/best case scenarios,
    and per-asset risk contributions — all derived from the model's
    probabilistic quantile bands (no Monte Carlo simulation required).
    """
    if not req.holdings:
        raise HTTPException(status_code=422, detail="No holdings provided.")

    total_weight = sum(h.weight for h in req.holdings)
    if total_weight <= 0:
        raise HTTPException(status_code=422, detail="Total portfolio weight must be > 0.")

    try:
        svc = get_risk_service()
        result = svc.compute_portfolio_risk(
            holdings=[h.model_dump() for h in req.holdings],
            horizon=req.horizon,
            confidence_level=req.confidence_level,
        )
        return PortfolioRiskResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
