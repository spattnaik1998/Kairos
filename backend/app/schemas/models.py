"""Pydantic schemas for all Kairos API request/response models."""

from __future__ import annotations
from typing import Optional
from pydantic import BaseModel, Field


# ─── Asset / Market Data ──────────────────────────────────────────────────────

class AssetHistoryResponse(BaseModel):
    ticker: str
    dates: list[str]
    close: list[float]
    volume: list[float]
    returns: list[float]  # daily log-returns


class MacroSeriesResponse(BaseModel):
    series_id: str
    name: str
    dates: list[str]
    values: list[float]


# ─── Forecast ─────────────────────────────────────────────────────────────────

class ForecastRequest(BaseModel):
    ticker: str = Field(..., description="Equity ticker, e.g. 'SPY'")
    horizon: int = Field(30, ge=1, le=128, description="Forecast horizon in trading days")
    context_days: int = Field(512, ge=64, le=1024, description="Historical context length")
    use_macro_covariates: bool = Field(
        False, description="Augment forecast with FRED macro covariates"
    )
    macro_series: list[str] = Field(
        default_factory=lambda: ["T10Y2Y", "UNRATE", "CPIAUCSL", "VIXCLS"],
        description="FRED series IDs to use as covariates",
    )


class QuantileForecast(BaseModel):
    q10: list[float]
    q20: list[float]
    q30: list[float]
    q40: list[float]
    q50: list[float]
    q60: list[float]
    q70: list[float]
    q80: list[float]
    q90: list[float]


class ForecastResponse(BaseModel):
    ticker: str
    horizon: int
    # Historical context (for chart overlay)
    history_dates: list[str]
    history_prices: list[float]
    # Forecast
    forecast_dates: list[str]
    point_forecast: list[float]
    quantiles: QuantileForecast
    # Metadata
    used_macro_covariates: bool
    macro_series_used: list[str]


# ─── Signals ──────────────────────────────────────────────────────────────────

class SignalItem(BaseModel):
    ticker: str
    name: str
    sector: str
    current_price: float
    forecast_median: float
    expected_return_pct: float          # (median - current) / current * 100
    signal: str                         # "STRONG BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG SELL"
    confidence: float                   # 0–1, based on quantile spread
    quantile_spread_pct: float          # (q90 - q10) / current * 100
    horizon_days: int


class SignalsResponse(BaseModel):
    signals: list[SignalItem]
    generated_at: str


# ─── Portfolio Risk ────────────────────────────────────────────────────────────

class PortfolioHolding(BaseModel):
    ticker: str
    weight: float = Field(..., ge=0.0, le=1.0)


class PortfolioRiskRequest(BaseModel):
    holdings: list[PortfolioHolding]
    horizon: int = Field(30, ge=1, le=128)
    confidence_level: float = Field(0.95, ge=0.90, le=0.99)


class AssetRiskContribution(BaseModel):
    ticker: str
    weight: float
    forecast_return_pct: float
    var_contribution_pct: float
    worst_case_pct: float   # 10th percentile


class PortfolioRiskResponse(BaseModel):
    horizon_days: int
    confidence_level: float
    # Portfolio-level metrics
    portfolio_expected_return_pct: float
    portfolio_var_pct: float            # Value at Risk
    portfolio_cvar_pct: float           # Conditional VaR / Expected Shortfall
    portfolio_worst_case_pct: float     # Simultaneous 10th pct scenario
    portfolio_best_case_pct: float      # Simultaneous 90th pct scenario
    # Per-asset
    asset_contributions: list[AssetRiskContribution]
    # Scenario distribution (for chart)
    scenario_returns: list[float]       # distribution of portfolio returns


# ─── Temporal Pattern Library ─────────────────────────────────────────────────

class PatternAnalogueRequest(BaseModel):
    lookback_days: int = Field(126, ge=30, le=504, description="Window to fingerprint (trading days)")
    n_analogues: int = Field(3, ge=1, le=5)
    fingerprint_series: list[str] = Field(
        default_factory=lambda: ["^VIX", "T10Y2Y", "BAMLH0A0HYM2", "DX-Y.NYB", "SPY"],
        description="Tickers/FRED series that form the market fingerprint",
    )


class AnalogueResult(BaseModel):
    rank: int
    start_date: str
    end_date: str
    similarity_score: float             # 0–1 cosine similarity
    label: str                          # Human-readable period name (e.g. "COVID crash 2020")
    # What happened in the 90 days after
    spx_return_90d: float
    bond_return_90d: float
    vix_change_90d: float
    # Normalized price series for overlay chart
    fingerprint_normalized: list[float]


class PatternAnalogueResponse(BaseModel):
    current_window_dates: list[str]
    current_fingerprint_normalized: list[float]
    analogues: list[AnalogueResult]
    interpretation: str                 # Plain-English summary


# ─── Macro ────────────────────────────────────────────────────────────────────

class MacroSnapshot(BaseModel):
    yield_curve_slope: Optional[float]   # 10Y - 2Y spread
    vix: Optional[float]
    cpi_yoy: Optional[float]
    unemployment_rate: Optional[float]
    fed_funds_rate: Optional[float]
    credit_spread_hy: Optional[float]    # HY OAS
    updated_at: str
