// ─── Shared TypeScript types for Kairos frontend ──────────────────────────────

export interface QuantileForecast {
  q10: number[];
  q20: number[];
  q30: number[];
  q40: number[];
  q50: number[];
  q60: number[];
  q70: number[];
  q80: number[];
  q90: number[];
}

export interface ForecastResponse {
  ticker: string;
  horizon: number;
  history_dates: string[];
  history_prices: number[];
  forecast_dates: string[];
  point_forecast: number[];
  quantiles: QuantileForecast;
  used_macro_covariates: boolean;
  macro_series_used: string[];
}

export interface SignalItem {
  ticker: string;
  name: string;
  sector: string;
  current_price: number;
  forecast_median: number;
  expected_return_pct: number;
  signal: "STRONG BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG SELL";
  confidence: number;
  quantile_spread_pct: number;
  horizon_days: number;
}

export interface SignalsResponse {
  signals: SignalItem[];
  generated_at: string;
}

export interface PortfolioHolding {
  ticker: string;
  weight: number;
}

export interface AssetRiskContribution {
  ticker: string;
  weight: number;
  forecast_return_pct: number;
  var_contribution_pct: number;
  worst_case_pct: number;
}

export interface PortfolioRiskResponse {
  horizon_days: number;
  confidence_level: number;
  portfolio_expected_return_pct: number;
  portfolio_var_pct: number;
  portfolio_cvar_pct: number;
  portfolio_worst_case_pct: number;
  portfolio_best_case_pct: number;
  asset_contributions: AssetRiskContribution[];
  scenario_returns: number[];
}

export interface AnalogueResult {
  rank: number;
  start_date: string;
  end_date: string;
  similarity_score: number;
  label: string;
  spx_return_90d: number;
  bond_return_90d: number;
  vix_change_90d: number;
  fingerprint_normalized: number[];
}

export interface PatternAnalogueResponse {
  current_window_dates: string[];
  current_fingerprint_normalized: number[];
  analogues: AnalogueResult[];
  interpretation: string;
}

export interface MacroSnapshot {
  yield_curve_slope: number | null;
  vix: number | null;
  cpi_yoy: number | null;
  unemployment_rate: number | null;
  fed_funds_rate: number | null;
  credit_spread_hy: number | null;
  updated_at: string;
}
