"""TimesFM forecast service — point forecasts, quantile bands, macro-covariate mode."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd

from ..core.model import get_timesfm_model
from ..core.config import get_settings
from .market_data import get_market_data_service, FRED_SERIES

logger = logging.getLogger(__name__)

# Quantile indices from TimesFM output: [q10, q20, q30, q40, q50, q60, q70, q80, q90]
Q_LABELS = ["q10", "q20", "q30", "q40", "q50", "q60", "q70", "q80", "q90"]


def _future_trading_dates(last_date: datetime, horizon: int) -> list[str]:
    """Generate approximately `horizon` future trading dates (Mon–Fri)."""
    dates = []
    current = last_date + timedelta(days=1)
    while len(dates) < horizon:
        if current.weekday() < 5:  # Mon–Fri
            dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    return dates


class ForecastService:
    """Wraps TimesFM to produce structured forecast responses."""

    def __init__(self):
        self.settings = get_settings()
        self.data_svc = get_market_data_service()

    def _get_model(self):
        return get_timesfm_model()

    def forecast_asset(
        self,
        ticker: str,
        horizon: int = 30,
        context_days: int = 512,
        use_macro_covariates: bool = False,
        macro_series: Optional[list[str]] = None,
    ) -> dict:
        """
        Forecast a single asset's close price.

        Returns a dict matching ForecastResponse schema.
        """
        model = self._get_model()
        closes = self.data_svc.get_close_series(ticker, days=context_days + 60)

        # Trim to context window
        closes = closes.dropna().iloc[-context_days:]
        if len(closes) < 30:
            raise ValueError(f"Insufficient price history for {ticker}")

        price_array = closes.values.astype(float)
        last_date = closes.index[-1].to_pydatetime()

        if use_macro_covariates and macro_series:
            point_fc, quantile_fc = self._forecast_with_macro(
                ticker, price_array, closes.index, horizon, macro_series
            )
        else:
            point_fc, quantile_fc = self._forecast_plain(price_array, horizon)

        # Build future prices from log-return style — TimesFM forecasts the series
        # directly (not returns), so we use values as-is
        point_prices = point_fc[:horizon].tolist()
        quantile_prices = {
            label: quantile_fc[:horizon, i].tolist()
            for i, label in enumerate(Q_LABELS)
        }

        forecast_dates = _future_trading_dates(last_date, horizon)

        return {
            "ticker": ticker,
            "horizon": horizon,
            "history_dates": [d.strftime("%Y-%m-%d") for d in closes.index],
            "history_prices": price_array.tolist(),
            "forecast_dates": forecast_dates[:horizon],
            "point_forecast": point_prices,
            "quantiles": quantile_prices,
            "used_macro_covariates": use_macro_covariates and bool(macro_series),
            "macro_series_used": macro_series or [],
        }

    def _forecast_plain(
        self, price_array: np.ndarray, horizon: int
    ) -> tuple[np.ndarray, np.ndarray]:
        """Zero-shot TimesFM forecast (no covariates)."""
        model = self._get_model()
        point_fc, quantile_fc = model.forecast(
            horizon=horizon,
            inputs=[price_array],
        )
        return point_fc[0], quantile_fc[0]

    def _forecast_with_macro(
        self,
        ticker: str,
        price_array: np.ndarray,
        price_index: pd.DatetimeIndex,
        horizon: int,
        macro_series: list[str],
    ) -> tuple[np.ndarray, np.ndarray]:
        """TimesFM forecast augmented with FRED macro covariates via XReg."""
        model = self._get_model()

        # We need future covariate values too (up to horizon steps ahead).
        # For macro series (monthly/weekly), forward-fill from last known value.
        extended_index = pd.date_range(
            start=price_index[0],
            periods=len(price_index) + horizon,
            freq="B",  # business days
        )

        dynamic_numerical_covariates: dict[str, list[list[float]]] = {}
        for sid in macro_series:
            raw = self.data_svc.get_macro_series(sid, days=len(price_index) + 90)
            if raw.empty:
                continue
            aligned = self.data_svc.align_series_to_daily(raw, extended_index)
            # shape: [1, context + horizon] — one time series
            dynamic_numerical_covariates[sid] = [aligned.tolist()]

        if not dynamic_numerical_covariates:
            logger.warning("No macro covariates available — falling back to plain forecast")
            return self._forecast_plain(price_array, horizon)

        try:
            new_point_outputs, new_quantile_outputs = model.forecast_with_covariates(
                inputs=[price_array.tolist()],
                dynamic_numerical_covariates=dynamic_numerical_covariates,
                xreg_mode="xreg + timesfm",
                normalize_xreg_target_per_input=True,
                ridge=0.1,
            )
            return np.array(new_point_outputs[0]), np.array(new_quantile_outputs[0])
        except Exception as e:
            logger.error(f"Covariate forecast failed: {e} — falling back to plain")
            return self._forecast_plain(price_array, horizon)

    def batch_forecast_for_signals(
        self,
        tickers: list[str],
        horizon: int = 30,
        context_days: int = 256,
    ) -> dict[str, dict]:
        """
        Batch forecast for the signal engine. Returns a dict mapping
        ticker → {point_forecast, quantiles, current_price}.
        """
        model = self._get_model()
        results = {}

        price_arrays = []
        valid_tickers = []

        for ticker in tickers:
            try:
                closes = self.data_svc.get_close_series(ticker, days=context_days + 30)
                closes = closes.dropna().iloc[-context_days:]
                if len(closes) < 30:
                    continue
                price_arrays.append(closes.values.astype(float))
                valid_tickers.append((ticker, float(closes.iloc[-1])))
            except Exception as e:
                logger.warning(f"Skipping {ticker}: {e}")

        if not price_arrays:
            return results

        # Batch forecast — TimesFM handles variable-length inputs
        point_fc, quantile_fc = model.forecast(
            horizon=horizon,
            inputs=price_arrays,
        )

        for i, (ticker, current_price) in enumerate(valid_tickers):
            results[ticker] = {
                "current_price": current_price,
                "point_forecast": point_fc[i][:horizon].tolist(),
                "quantiles": {
                    label: quantile_fc[i][:horizon, j].tolist()
                    for j, label in enumerate(Q_LABELS)
                },
            }

        return results


_service: Optional[ForecastService] = None


def get_forecast_service() -> ForecastService:
    global _service
    if _service is None:
        _service = ForecastService()
    return _service
