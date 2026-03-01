/**
 * Kairos API client — typed wrappers around the FastAPI backend.
 */

import axios from "axios";
import type {
  ForecastResponse,
  SignalsResponse,
  PortfolioRiskResponse,
  PatternAnalogueResponse,
  MacroSnapshot,
} from "@/types";

const client = axios.create({
  baseURL: "/api/v1",
  timeout: 120_000, // model inference can take a while on first call
});

// ─── Assets ───────────────────────────────────────────────────────────────────

export async function getAssetHistory(ticker: string, days = 252) {
  const { data } = await client.get(`/assets/${ticker}/history`, { params: { days } });
  return data;
}

export async function getMacroSnapshot(): Promise<MacroSnapshot> {
  const { data } = await client.get("/assets/macro/snapshot");
  return data;
}

export async function getMacroSeries(seriesId: string, days = 756) {
  const { data } = await client.get(`/assets/macro/${seriesId}`, { params: { days } });
  return data;
}

export async function getUniverse() {
  const { data } = await client.get("/assets/universe");
  return data as Record<string, { name: string; sector: string }>;
}

// ─── Forecast ─────────────────────────────────────────────────────────────────

export interface ForecastRequest {
  ticker: string;
  horizon?: number;
  context_days?: number;
  use_macro_covariates?: boolean;
  macro_series?: string[];
}

export async function getForecast(req: ForecastRequest): Promise<ForecastResponse> {
  const { data } = await client.post("/forecast", {
    horizon: 30,
    context_days: 512,
    use_macro_covariates: false,
    macro_series: ["T10Y2Y", "UNRATE", "CPIAUCSL", "VIXCLS"],
    ...req,
  });
  return data;
}

// ─── Signals ──────────────────────────────────────────────────────────────────

export async function getSignals(horizon = 30, tickers = ""): Promise<SignalsResponse> {
  const { data } = await client.get("/signals", { params: { horizon, tickers } });
  return data;
}

// ─── Portfolio Risk ────────────────────────────────────────────────────────────

export interface PortfolioRiskRequest {
  holdings: { ticker: string; weight: number }[];
  horizon?: number;
  confidence_level?: number;
}

export async function getPortfolioRisk(req: PortfolioRiskRequest): Promise<PortfolioRiskResponse> {
  const { data } = await client.post("/portfolio/risk", {
    horizon: 30,
    confidence_level: 0.95,
    ...req,
  });
  return data;
}

// ─── Temporal Pattern Library ─────────────────────────────────────────────────

export interface PatternRequest {
  lookback_days?: number;
  n_analogues?: number;
  fingerprint_series?: string[];
}

export async function getAnalogues(req: PatternRequest = {}): Promise<PatternAnalogueResponse> {
  const { data } = await client.post("/patterns/analogues", {
    lookback_days: 126,
    n_analogues: 3,
    fingerprint_series: ["SPY", "^VIX", "TLT", "GLD", "HYG"],
    ...req,
  });
  return data;
}
