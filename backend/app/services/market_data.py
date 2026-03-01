"""Market data service — yfinance for price data, FRED for macro data."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

import duckdb
import numpy as np
import pandas as pd
import yfinance as yf

from ..core.config import get_settings

logger = logging.getLogger(__name__)

# Well-known tickers for the signal universe
SIGNAL_UNIVERSE = {
    # US Equities — broad market
    "SPY":  {"name": "SPDR S&P 500 ETF",         "sector": "Broad Market"},
    "QQQ":  {"name": "Invesco QQQ (Nasdaq 100)",  "sector": "Technology"},
    "IWM":  {"name": "iShares Russell 2000",       "sector": "Small Cap"},
    # Sectors
    "XLF":  {"name": "Financial Select SPDR",      "sector": "Financials"},
    "XLE":  {"name": "Energy Select SPDR",         "sector": "Energy"},
    "XLK":  {"name": "Technology Select SPDR",     "sector": "Technology"},
    "XLV":  {"name": "Health Care Select SPDR",    "sector": "Health Care"},
    "XLI":  {"name": "Industrial Select SPDR",     "sector": "Industrials"},
    "XLP":  {"name": "Consumer Staples SPDR",      "sector": "Consumer Staples"},
    "XLY":  {"name": "Consumer Discr. SPDR",       "sector": "Consumer Discretionary"},
    "XLU":  {"name": "Utilities Select SPDR",      "sector": "Utilities"},
    "XLRE": {"name": "Real Estate Select SPDR",    "sector": "Real Estate"},
    # Fixed Income
    "TLT":  {"name": "iShares 20+ Year Treasury",  "sector": "Long-Duration Bonds"},
    "IEF":  {"name": "iShares 7-10 Year Treasury", "sector": "Mid-Duration Bonds"},
    "HYG":  {"name": "iShares HY Corp Bond",       "sector": "High Yield Credit"},
    "LQD":  {"name": "iShares IG Corp Bond",       "sector": "Investment Grade Credit"},
    # Commodities & FX
    "GLD":  {"name": "SPDR Gold Shares",           "sector": "Commodities"},
    "USO":  {"name": "United States Oil Fund",     "sector": "Commodities"},
    "DBC":  {"name": "Invesco DB Commodity Index", "sector": "Commodities"},
    # Volatility
    "^VIX": {"name": "CBOE Volatility Index",      "sector": "Volatility"},
}

# FRED series used as macro covariates
FRED_SERIES = {
    "T10Y2Y":     "10Y-2Y Yield Curve Slope",
    "UNRATE":     "US Unemployment Rate",
    "CPIAUCSL":   "CPI (All Urban Consumers)",
    "FEDFUNDS":   "Federal Funds Rate",
    "BAMLH0A0HYM2": "HY OAS Credit Spread",
    "VIXCLS":     "VIX (FRED)",
    "M2SL":       "M2 Money Supply",
    "UMCSENT":    "U Michigan Consumer Sentiment",
}


class MarketDataService:
    """Fetches and caches market + macro data."""

    def __init__(self):
        self.settings = get_settings()
        self._init_cache()

    def _init_cache(self):
        import os
        os.makedirs("./data", exist_ok=True)
        self._db = duckdb.connect(self.settings.cache_db_path)
        self._db.execute("""
            CREATE TABLE IF NOT EXISTS price_cache (
                ticker      VARCHAR,
                date        DATE,
                open        DOUBLE,
                high        DOUBLE,
                low         DOUBLE,
                close       DOUBLE,
                volume      DOUBLE,
                cached_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (ticker, date)
            )
        """)
        self._db.execute("""
            CREATE TABLE IF NOT EXISTS macro_cache (
                series_id   VARCHAR,
                date        DATE,
                value       DOUBLE,
                cached_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (series_id, date)
            )
        """)

    def get_price_history(
        self,
        ticker: str,
        days: int = 756,
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        """Return OHLCV DataFrame for a ticker. Uses DuckDB cache."""
        end = datetime.today()
        start = end - timedelta(days=days)

        if not force_refresh:
            cached = self._db.execute(
                "SELECT date, open, high, low, close, volume FROM price_cache "
                "WHERE ticker = ? AND date >= ? ORDER BY date",
                [ticker, start.date()],
            ).fetchdf()
            # Cache hit: data covers most of requested window
            if len(cached) > days * 0.8:
                cached["date"] = pd.to_datetime(cached["date"])
                return cached.set_index("date")

        logger.info(f"Fetching {ticker} from yfinance ({days}d)")
        df = yf.download(ticker, start=start, end=end, auto_adjust=True, progress=False)
        if df.empty:
            raise ValueError(f"No price data found for ticker: {ticker}")

        # Flatten multi-index columns if present
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = [col[0].lower() for col in df.columns]
        else:
            df.columns = [c.lower() for c in df.columns]

        df = df.reset_index()
        df.rename(columns={"Date": "date", "index": "date"}, inplace=True)
        df["date"] = pd.to_datetime(df["date"]).dt.date
        df["ticker"] = ticker

        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = df[col].astype(float)

        rows = df[["ticker", "date", "open", "high", "low", "close", "volume"]].to_records(index=False)
        self._db.executemany(
            "INSERT OR REPLACE INTO price_cache VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
            [tuple(r) for r in rows],
        )

        df["date"] = pd.to_datetime(df["date"])
        return df.set_index("date")[["open", "high", "low", "close", "volume"]]

    def get_macro_series(
        self,
        series_id: str,
        days: int = 756,
        force_refresh: bool = False,
    ) -> pd.Series:
        """Return a FRED macro series as a daily-forward-filled pd.Series."""
        if not self.settings.fred_api_key:
            logger.warning("FRED_API_KEY not set — skipping macro fetch")
            return pd.Series(dtype=float)

        end = datetime.today()
        start = end - timedelta(days=days)

        if not force_refresh:
            cached = self._db.execute(
                "SELECT date, value FROM macro_cache "
                "WHERE series_id = ? AND date >= ? ORDER BY date",
                [series_id, start.date()],
            ).fetchdf()
            if not cached.empty and len(cached) > 20:
                cached["date"] = pd.to_datetime(cached["date"])
                return cached.set_index("date")["value"]

        try:
            from fredapi import Fred
            fred = Fred(api_key=self.settings.fred_api_key)
            series = fred.get_series(series_id, observation_start=start, observation_end=end)
            series = series.dropna()

            if series.empty:
                return pd.Series(dtype=float)

            rows = [(series_id, d.date(), float(v)) for d, v in series.items()]
            self._db.executemany(
                "INSERT OR REPLACE INTO macro_cache VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
                rows,
            )
            return series

        except Exception as e:
            logger.error(f"FRED fetch failed for {series_id}: {e}")
            return pd.Series(dtype=float)

    def get_macro_snapshot(self) -> dict:
        """Return the latest values for key macro indicators."""
        snapshot = {}
        for sid in ["T10Y2Y", "VIXCLS", "CPIAUCSL", "UNRATE", "FEDFUNDS", "BAMLH0A0HYM2"]:
            s = self.get_macro_series(sid, days=30)
            snapshot[sid] = float(s.iloc[-1]) if not s.empty else None
        return snapshot

    def get_log_returns(self, ticker: str, days: int = 756) -> np.ndarray:
        """Return daily log-returns as a numpy array."""
        df = self.get_price_history(ticker, days=days)
        closes = df["close"].dropna().values
        if len(closes) < 2:
            return np.array([])
        return np.diff(np.log(closes))

    def get_close_series(self, ticker: str, days: int = 756) -> pd.Series:
        """Return close price series."""
        df = self.get_price_history(ticker, days=days)
        return df["close"].dropna()

    def align_series_to_daily(
        self, series: pd.Series, reference: pd.DatetimeIndex
    ) -> np.ndarray:
        """Forward-fill and align a (possibly monthly/weekly) series to a daily index."""
        series = series.reindex(reference, method="ffill").ffill().bfill()
        return series.values.astype(float)


# Module-level singleton
_service: Optional[MarketDataService] = None


def get_market_data_service() -> MarketDataService:
    global _service
    if _service is None:
        _service = MarketDataService()
    return _service
