"use client";

import { useState } from "react";
import { TrendingUp, Loader2, Info } from "lucide-react";
import { getForecast } from "@/lib/api";
import type { ForecastResponse } from "@/types";
import { ForecastChart } from "@/components/charts/ForecastChart";
import { formatPrice, formatPct } from "@/lib/utils";

const MACRO_SERIES = [
  { id: "T10Y2Y",   label: "Yield Curve (10Y-2Y)" },
  { id: "UNRATE",   label: "Unemployment Rate" },
  { id: "CPIAUCSL", label: "CPI YoY" },
  { id: "VIXCLS",   label: "VIX" },
];

export default function ForecastPage() {
  const [ticker, setTicker] = useState("SPY");
  const [horizon, setHorizon] = useState(30);
  const [useMacro, setUseMacro] = useState(false);
  const [selectedMacro, setSelectedMacro] = useState<string[]>(["T10Y2Y", "VIXCLS"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ForecastResponse | null>(null);

  const handleForecast = async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getForecast({
        ticker: ticker.trim().toUpperCase(),
        horizon,
        context_days: 512,
        use_macro_covariates: useMacro,
        macro_series: selectedMacro,
      });
      setResult(data);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? e.message ?? "Forecast failed");
    } finally {
      setLoading(false);
    }
  };

  const q50_end = result ? result.quantiles.q50[result.quantiles.q50.length - 1] : null;
  const q10_end = result ? result.quantiles.q10[result.quantiles.q10.length - 1] : null;
  const q90_end = result ? result.quantiles.q90[result.quantiles.q90.length - 1] : null;
  const current = result ? result.history_prices[result.history_prices.length - 1] : null;
  const expectedReturn = q50_end && current ? (q50_end - current) / current * 100 : null;

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <TrendingUp className="w-7 h-7 text-amber-400" />
          Asset Forecast
        </h1>
        <p className="text-kairos-subtle mt-1">
          Probabilistic price forecasts using TimesFM 2.5 — point estimate + full quantile distribution.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-kairos-surface border border-kairos-border rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-kairos-subtle mb-1 uppercase tracking-wide">
              Ticker
            </label>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleForecast()}
              placeholder="e.g. SPY, QQQ, AAPL"
              className="w-full bg-kairos-bg border border-kairos-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-kairos-subtle mb-1 uppercase tracking-wide">
              Horizon (trading days)
            </label>
            <select
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
              className="w-full bg-kairos-bg border border-kairos-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500 transition-colors"
            >
              {[5, 10, 21, 30, 63, 90, 128].map((h) => (
                <option key={h} value={h}>
                  {h} days {h === 21 ? "(~1 month)" : h === 63 ? "(~3 months)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleForecast}
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg px-4 py-2 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Forecasting…
                </>
              ) : (
                "Run Forecast"
              )}
            </button>
          </div>
        </div>

        {/* Macro toggle */}
        <div className="flex items-start gap-3 p-3 bg-kairos-bg rounded-lg border border-kairos-border">
          <input
            type="checkbox"
            id="macro"
            checked={useMacro}
            onChange={(e) => setUseMacro(e.target.checked)}
            className="mt-0.5 accent-amber-500"
          />
          <div>
            <label htmlFor="macro" className="text-sm font-medium cursor-pointer">
              Augment with macro covariates (FRED)
            </label>
            <p className="text-xs text-kairos-subtle mt-0.5">
              Uses TimesFM XReg to incorporate macro indicators as dynamic covariates.
              Requires FRED_API_KEY.
            </p>
            {useMacro && (
              <div className="flex flex-wrap gap-2 mt-2">
                {MACRO_SERIES.map(({ id, label }) => (
                  <label key={id} className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMacro.includes(id)}
                      onChange={(e) =>
                        setSelectedMacro((prev) =>
                          e.target.checked ? [...prev, id] : prev.filter((x) => x !== id)
                        )
                      }
                      className="accent-amber-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6 fade-in">
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Current Price", value: formatPrice(current!), color: "text-kairos-text" },
              {
                label: `Forecast (${horizon}d median)`,
                value: formatPrice(q50_end!),
                color: expectedReturn! >= 0 ? "text-emerald-400" : "text-red-400",
              },
              {
                label: "Expected Return",
                value: formatPct(expectedReturn!),
                color: expectedReturn! >= 0 ? "text-emerald-400" : "text-red-400",
              },
              {
                label: "Uncertainty Band",
                value: `${formatPrice(q10_end!)} – ${formatPrice(q90_end!)}`,
                color: "text-amber-400",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-kairos-surface border border-kairos-border rounded-xl p-4">
                <p className="text-xs text-kairos-subtle mb-1">{label}</p>
                <p className={`font-bold font-mono ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <ForecastChart data={result} />

          {/* Quantile table */}
          <div className="bg-kairos-surface border border-kairos-border rounded-2xl p-5">
            <h3 className="text-sm font-semibold mb-3 text-kairos-subtle uppercase tracking-wide">
              Quantile Distribution at Horizon
            </h3>
            <div className="grid grid-cols-9 gap-1 text-center">
              {(["q10","q20","q30","q40","q50","q60","q70","q80","q90"] as const).map((q) => {
                const val = result.quantiles[q][result.quantiles[q].length - 1];
                const ret = (val - current!) / current! * 100;
                return (
                  <div key={q} className="bg-kairos-bg rounded-lg p-2">
                    <p className="text-[10px] text-kairos-subtle">{q.toUpperCase()}</p>
                    <p className="text-xs font-mono font-bold mt-1">{formatPrice(val)}</p>
                    <p className={`text-[10px] mt-0.5 ${ret >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatPct(ret, 1)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="bg-kairos-surface border border-dashed border-kairos-border rounded-2xl p-16 text-center">
          <TrendingUp className="w-10 h-10 text-kairos-subtle mx-auto mb-3" />
          <p className="text-kairos-subtle">Enter a ticker and run forecast to see results.</p>
          <p className="text-xs text-kairos-subtle/60 mt-1">
            First run may take ~30s while TimesFM initialises.
          </p>
        </div>
      )}
    </div>
  );
}
