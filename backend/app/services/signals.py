"""Signal generation service — quantile-weighted mean reversion signals."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

import numpy as np

from .forecaster import get_forecast_service
from .market_data import SIGNAL_UNIVERSE

logger = logging.getLogger(__name__)


def _classify_signal(expected_return: float, confidence: float) -> str:
    """Map (expected_return, confidence) to a categorical signal label."""
    # Confidence-adjusted return threshold
    adj = expected_return * confidence
    if adj > 3.0:
        return "STRONG BUY"
    elif adj > 1.0:
        return "BUY"
    elif adj < -3.0:
        return "STRONG SELL"
    elif adj < -1.0:
        return "SELL"
    return "NEUTRAL"


class SignalService:
    """Generates ranked signals for the full universe using TimesFM forecasts."""

    def __init__(self):
        self.forecast_svc = get_forecast_service()

    def generate_signals(
        self,
        tickers: Optional[list[str]] = None,
        horizon: int = 30,
        context_days: int = 256,
    ) -> list[dict]:
        """
        Run TimesFM on the signal universe and return ranked signals.

        Signal logic:
        - Expected return = (median_forecast_at_horizon - current_price) / current_price * 100
        - Confidence = 1 - (q90 - q10) / (2 * median_forecast) normalised to [0,1]
          Wide quantile spread → low confidence → closer to NEUTRAL
        - Quantile spread: captures forecast uncertainty for the risk-averse
        """
        universe = tickers or [t for t in SIGNAL_UNIVERSE if not t.startswith("^")]
        meta = {t: SIGNAL_UNIVERSE.get(t, {"name": t, "sector": "Unknown"}) for t in universe}

        logger.info(f"Generating signals for {len(universe)} assets (horizon={horizon}d)")
        batch = self.forecast_svc.batch_forecast_for_signals(
            universe, horizon=horizon, context_days=context_days
        )

        signals = []
        for ticker, fc in batch.items():
            current = fc["current_price"]
            if current <= 0:
                continue

            q10_end = fc["quantiles"]["q10"][-1]
            q50_end = fc["quantiles"]["q50"][-1]
            q90_end = fc["quantiles"]["q90"][-1]
            point_end = fc["point_forecast"][-1]

            median_fc = q50_end if q50_end > 0 else point_end
            spread = abs(q90_end - q10_end)

            expected_return_pct = (median_fc - current) / current * 100
            spread_pct = spread / current * 100

            # Confidence: tighter spread → higher confidence (capped at 1)
            # Normalise: spread < 2% of price → high confidence
            raw_conf = max(0.0, 1.0 - spread_pct / 20.0)
            confidence = round(min(1.0, raw_conf), 3)

            signal = _classify_signal(expected_return_pct, confidence)

            signals.append({
                "ticker": ticker,
                "name": meta[ticker]["name"],
                "sector": meta[ticker]["sector"],
                "current_price": round(current, 2),
                "forecast_median": round(median_fc, 2),
                "expected_return_pct": round(expected_return_pct, 2),
                "signal": signal,
                "confidence": confidence,
                "quantile_spread_pct": round(spread_pct, 2),
                "horizon_days": horizon,
            })

        # Sort: strongest signals first (by absolute confidence-adjusted return)
        signals.sort(key=lambda x: abs(x["expected_return_pct"] * x["confidence"]), reverse=True)
        return signals


_service: Optional[SignalService] = None


def get_signal_service() -> SignalService:
    global _service
    if _service is None:
        _service = SignalService()
    return _service
