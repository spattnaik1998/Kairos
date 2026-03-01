"""
Temporal Pattern Library — finds historical market analogues.

Uses TimesFM's 16k context window + cosine similarity to identify
historical periods that most closely resemble the current market environment.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd

from .market_data import get_market_data_service

logger = logging.getLogger(__name__)

# Named historical periods for labelling found analogues
NAMED_PERIODS = [
    ("1987-10-01", "1987-10-31", "Black Monday 1987"),
    ("1997-10-01", "1997-11-30", "Asian Financial Crisis 1997"),
    ("1998-08-01", "1998-09-30", "LTCM / Russia Crisis 1998"),
    ("2000-03-01", "2000-12-31", "Dot-com Bubble Top 2000"),
    ("2001-09-01", "2001-10-31", "Post-9/11 2001"),
    ("2002-06-01", "2002-10-31", "Dot-com Bear Market Bottom 2002"),
    ("2007-10-01", "2008-03-31", "GFC Early Stage 2007-08"),
    ("2008-09-01", "2008-12-31", "GFC Lehman Crisis 2008"),
    ("2009-03-01", "2009-06-30", "GFC Recovery 2009"),
    ("2010-04-01", "2010-07-31", "Flash Crash 2010"),
    ("2011-07-01", "2011-10-31", "US Debt Downgrade 2011"),
    ("2015-08-01", "2015-09-30", "China Devaluation Shock 2015"),
    ("2018-09-01", "2018-12-31", "Q4 Rate Fear Selloff 2018"),
    ("2020-01-20", "2020-04-30", "COVID-19 Crash 2020"),
    ("2020-04-01", "2020-08-31", "COVID Recovery Rally 2020"),
    ("2021-11-01", "2022-06-30", "Inflation Shock / Rate Hike Cycle 2022"),
    ("2022-09-01", "2022-12-31", "Rates Peak / Bear Market 2022"),
    ("2023-03-01", "2023-05-31", "SVB Banking Crisis 2023"),
    ("2023-10-01", "2024-01-31", "AI Rally Momentum 2023-24"),
]


def _normalise(series: np.ndarray) -> np.ndarray:
    """Z-score normalise a 1D array. Returns zeros if std is near 0."""
    std = np.std(series)
    if std < 1e-9:
        return np.zeros_like(series)
    return (series - np.mean(series)) / std


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two 1D vectors."""
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom < 1e-9:
        return 0.0
    return float(np.dot(a, b) / denom)


def _get_period_label(start: datetime) -> str:
    """Return a named label if the date falls within a known historical period."""
    for ps, pe, label in NAMED_PERIODS:
        if pd.Timestamp(ps) <= pd.Timestamp(start) <= pd.Timestamp(pe):
            return label
    return start.strftime("%b %Y")


class PatternService:
    """Identifies historical market analogues using temporal fingerprinting."""

    def __init__(self):
        self.data_svc = get_market_data_service()

    def _build_fingerprint(
        self,
        price_series: list[pd.Series],
        window: np.ndarray,
    ) -> np.ndarray:
        """
        Stack and normalise multiple price series into a single fingerprint vector.
        Each series is z-score normalised then concatenated.
        """
        vectors = [_normalise(s) for s in price_series]
        # Stack into a matrix and flatten — shape: (n_series * window_len,)
        stacked = np.concatenate(vectors)
        return stacked

    def find_analogues(
        self,
        lookback_days: int = 126,
        n_analogues: int = 3,
        fingerprint_series: Optional[list[str]] = None,
    ) -> dict:
        """
        Find the top-n historical windows most similar to the current market environment.

        Returns dates, similarity scores, and post-analogue outcomes.
        """
        if fingerprint_series is None:
            fingerprint_series = ["SPY", "^VIX", "TLT", "GLD", "HYG"]

        # Fetch long history for each series (up to 10 years = ~2520 trading days)
        max_history_days = 2520 + lookback_days
        series_data: dict[str, pd.Series] = {}

        for ticker in fingerprint_series:
            try:
                # VIX and others may not have full history
                s = self.data_svc.get_close_series(ticker, days=max_history_days)
                s = s.dropna()
                if len(s) > lookback_days * 2:
                    series_data[ticker] = s
            except Exception as e:
                logger.warning(f"Could not fetch {ticker}: {e}")

        if not series_data:
            raise ValueError("Could not fetch any fingerprint series data.")

        # Align all series to a common date index
        common_index = None
        for s in series_data.values():
            if common_index is None:
                common_index = s.index
            else:
                common_index = common_index.intersection(s.index)

        aligned: dict[str, np.ndarray] = {}
        for ticker, s in series_data.items():
            aligned[ticker] = s.reindex(common_index).ffill().values.astype(float)

        n_total = len(common_index)
        if n_total < lookback_days + 90:
            raise ValueError(f"Insufficient history: only {n_total} common trading days.")

        # Current fingerprint: last `lookback_days` observations
        current_windows = [
            _normalise(arr[-lookback_days:]) for arr in aligned.values()
        ]
        current_fp = np.concatenate(current_windows)

        current_dates = common_index[-lookback_days:]

        # Slide window across history (step=5 trading days for speed)
        step = 5
        scores: list[tuple[float, int]] = []  # (similarity, start_idx)

        # Don't compare the last lookback_days (current window)
        search_end = n_total - lookback_days - 90  # need 90d of future data after each window

        for start_idx in range(0, search_end, step):
            end_idx = start_idx + lookback_days
            hist_windows = [
                _normalise(arr[start_idx:end_idx]) for arr in aligned.values()
            ]
            hist_fp = np.concatenate(hist_windows)
            sim = _cosine_similarity(current_fp, hist_fp)
            scores.append((sim, start_idx))

        scores.sort(key=lambda x: x[0], reverse=True)

        # De-duplicate: skip windows that overlap with a higher-ranked match
        selected: list[tuple[float, int]] = []
        for sim, idx in scores:
            if all(abs(idx - s_idx) >= lookback_days for _, s_idx in selected):
                selected.append((sim, idx))
            if len(selected) >= n_analogues:
                break

        # Build result for each analogue
        analogues = []
        for rank, (sim, start_idx) in enumerate(selected, 1):
            end_idx = start_idx + lookback_days
            window_dates = common_index[start_idx:end_idx]
            future_idx_end = min(end_idx + 90, n_total)

            # Outcome: SPY return over 90 days after analogue
            spy_arr = aligned.get("SPY", list(aligned.values())[0])
            spy_price_at_end = spy_arr[end_idx - 1]
            spy_future = spy_arr[end_idx:future_idx_end]
            spx_return = float((spy_future[-1] / spy_price_at_end - 1) * 100) if len(spy_future) > 0 else 0.0

            # TLT outcome
            tlt_arr = aligned.get("TLT", spy_arr)
            tlt_price_at_end = tlt_arr[end_idx - 1]
            tlt_future = tlt_arr[end_idx:future_idx_end]
            bond_return = float((tlt_future[-1] / tlt_price_at_end - 1) * 100) if len(tlt_future) > 0 else 0.0

            # VIX outcome
            vix_arr = aligned.get("^VIX", spy_arr)
            vix_at_start = vix_arr[end_idx - 1]
            vix_future = vix_arr[end_idx:future_idx_end]
            vix_change = float(vix_future[-1] - vix_at_start) if len(vix_future) > 0 else 0.0

            # Normalised fingerprint for overlay chart
            spy_window = _normalise(spy_arr[start_idx:end_idx]).tolist()

            start_date = window_dates[0]
            end_date = window_dates[-1]
            label = _get_period_label(start_date.to_pydatetime())

            analogues.append({
                "rank": rank,
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d"),
                "similarity_score": round(sim, 4),
                "label": label,
                "spx_return_90d": round(spx_return, 2),
                "bond_return_90d": round(bond_return, 2),
                "vix_change_90d": round(vix_change, 2),
                "fingerprint_normalized": [round(v, 4) for v in spy_window],
            })

        # Interpretation
        if analogues:
            top = analogues[0]
            interpretation = (
                f"The current {lookback_days}-day market environment (similarity: "
                f"{top['similarity_score']:.1%}) most closely resembles {top['label']}. "
                f"In the 90 days following that period, the S&P 500 returned "
                f"{top['spx_return_90d']:+.1f}% and the VIX changed "
                f"{top['vix_change_90d']:+.1f} points."
            )
        else:
            interpretation = "No strong historical analogues found."

        # Current fingerprint: normalised SPY for chart
        current_spy_norm = _normalise(aligned["SPY"][-lookback_days:]).tolist() if "SPY" in aligned else []

        return {
            "current_window_dates": [d.strftime("%Y-%m-%d") for d in current_dates],
            "current_fingerprint_normalized": [round(v, 4) for v in current_spy_norm],
            "analogues": analogues,
            "interpretation": interpretation,
        }


_service: Optional[PatternService] = None


def get_pattern_service() -> PatternService:
    global _service
    if _service is None:
        _service = PatternService()
    return _service
