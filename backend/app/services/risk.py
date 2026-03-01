"""Portfolio risk service — VaR/CVaR directly from TimesFM quantile bands."""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np

from .forecaster import get_forecast_service

logger = logging.getLogger(__name__)

# TimesFM outputs 9 quantiles: 10th through 90th in steps of 10.
# We map these to approximate probability mass for VaR/CVaR estimation.
QUANTILE_LEVELS = [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90]
Q_KEYS = ["q10", "q20", "q30", "q40", "q50", "q60", "q70", "q80", "q90"]


def _build_return_distribution(
    current_price: float,
    quantile_forecast: dict[str, list[float]],
    horizon: int,
) -> np.ndarray:
    """
    Construct a return distribution at the end of the horizon.

    Strategy: use the 9 quantile endpoints as empirical quantiles,
    then interpolate a dense return distribution via linear interpolation.
    """
    # Cumulative return at horizon endpoint for each quantile
    quantile_returns = np.array(
        [quantile_forecast[k][-1] / current_price - 1.0 for k in Q_KEYS]
    )

    # Dense distribution: interpolate between quantile points
    # Sample 1000 points from a piecewise linear CDF
    probs = np.array(QUANTILE_LEVELS)
    dense_probs = np.linspace(0.05, 0.95, 1000)
    dense_returns = np.interp(dense_probs, probs, quantile_returns)

    return dense_returns


class RiskService:
    """Computes portfolio-level risk metrics from TimesFM quantile forecasts."""

    def __init__(self):
        self.forecast_svc = get_forecast_service()

    def compute_portfolio_risk(
        self,
        holdings: list[dict],  # [{"ticker": str, "weight": float}]
        horizon: int = 30,
        confidence_level: float = 0.95,
    ) -> dict:
        """
        Compute VaR, CVaR, and scenario returns for a portfolio.

        Method:
        - Fetch TimesFM forecasts for each holding
        - Build individual return distributions from quantile bands
        - Combine using portfolio weights (simplified: weighted average of distributions)
        - Compute VaR and CVaR on the aggregate distribution
        """
        tickers = [h["ticker"] for h in holdings]
        weights = np.array([h["weight"] for h in holdings], dtype=float)
        weights /= weights.sum()  # normalise to 1

        batch = self.forecast_svc.batch_forecast_for_signals(
            tickers, horizon=horizon, context_days=256
        )

        asset_distributions: list[np.ndarray] = []
        asset_contributions: list[dict] = []

        for h, w in zip(holdings, weights):
            ticker = h["ticker"]
            if ticker not in batch:
                logger.warning(f"No forecast for {ticker}, skipping")
                continue

            fc = batch[ticker]
            current = fc["current_price"]
            dist = _build_return_distribution(current, fc["quantiles"], horizon)

            asset_distributions.append(dist * w)

            q10_ret = fc["quantiles"]["q10"][-1] / current - 1.0
            q50_ret = fc["quantiles"]["q50"][-1] / current - 1.0

            asset_contributions.append({
                "ticker": ticker,
                "weight": round(float(w), 4),
                "forecast_return_pct": round(q50_ret * 100, 2),
                "var_contribution_pct": round(q10_ret * 100 * float(w), 2),
                "worst_case_pct": round(q10_ret * 100, 2),
            })

        if not asset_distributions:
            raise ValueError("No valid forecasts available for portfolio holdings.")

        # Portfolio return distribution: weighted sum of individual distributions
        portfolio_dist = np.sum(asset_distributions, axis=0)  # (1000,)

        # Sort for VaR/CVaR
        sorted_dist = np.sort(portfolio_dist)

        var_idx = int((1 - confidence_level) * len(sorted_dist))
        var = sorted_dist[var_idx]
        cvar = sorted_dist[:var_idx].mean() if var_idx > 0 else sorted_dist[0]

        # Expected return (median)
        expected_return = float(np.median(portfolio_dist))
        worst_case = float(sorted_dist[0])
        best_case = float(sorted_dist[-1])

        return {
            "horizon_days": horizon,
            "confidence_level": confidence_level,
            "portfolio_expected_return_pct": round(expected_return * 100, 2),
            "portfolio_var_pct": round(float(var) * 100, 2),
            "portfolio_cvar_pct": round(float(cvar) * 100, 2),
            "portfolio_worst_case_pct": round(worst_case * 100, 2),
            "portfolio_best_case_pct": round(best_case * 100, 2),
            "asset_contributions": asset_contributions,
            # 200-point sample for chart rendering
            "scenario_returns": [round(v * 100, 3) for v in sorted_dist[::5]],
        }


_service: Optional[RiskService] = None


def get_risk_service() -> RiskService:
    global _service
    if _service is None:
        _service = RiskService()
    return _service
