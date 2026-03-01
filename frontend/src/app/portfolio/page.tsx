"use client";

import { useState } from "react";
import { Shield, Loader2, Plus, Trash2 } from "lucide-react";
import { getPortfolioRisk } from "@/lib/api";
import type { PortfolioRiskResponse, PortfolioHolding } from "@/types";
import { formatPct } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, AreaChart, Area,
} from "recharts";

const DEFAULT_PORTFOLIO: PortfolioHolding[] = [
  { ticker: "SPY", weight: 0.50 },
  { ticker: "TLT", weight: 0.25 },
  { ticker: "GLD", weight: 0.15 },
  { ticker: "HYG", weight: 0.10 },
];

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState<PortfolioHolding[]>(DEFAULT_PORTFOLIO);
  const [horizon, setHorizon] = useState(30);
  const [confidence, setConfidence] = useState(0.95);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PortfolioRiskResponse | null>(null);

  const addHolding = () =>
    setHoldings((prev) => [...prev, { ticker: "", weight: 0.1 }]);

  const removeHolding = (i: number) =>
    setHoldings((prev) => prev.filter((_, idx) => idx !== i));

  const updateHolding = (i: number, field: keyof PortfolioHolding, value: string) =>
    setHoldings((prev) =>
      prev.map((h, idx) =>
        idx === i ? { ...h, [field]: field === "weight" ? parseFloat(value) || 0 : value.toUpperCase() } : h
      )
    );

  const handleSubmit = async () => {
    const valid = holdings.filter((h) => h.ticker && h.weight > 0);
    if (valid.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getPortfolioRisk({ holdings: valid, horizon, confidence_level: confidence });
      setResult(data);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const totalWeight = holdings.reduce((s, h) => s + (h.weight || 0), 0);

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="w-7 h-7 text-purple-400" />
          Portfolio Risk
        </h1>
        <p className="text-kairos-subtle mt-1">
          VaR, CVaR and scenario analysis — derived directly from TimesFM&apos;s quantile bands.
          No Monte Carlo simulation required.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Portfolio Builder */}
        <div className="bg-kairos-surface border border-kairos-border rounded-2xl p-6">
          <h2 className="font-semibold mb-4 text-sm uppercase tracking-wide text-kairos-subtle">
            Portfolio Holdings
          </h2>

          <div className="space-y-2 mb-4">
            {holdings.map((h, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={h.ticker}
                  onChange={(e) => updateHolding(i, "ticker", e.target.value)}
                  placeholder="Ticker"
                  className="flex-1 bg-kairos-bg border border-kairos-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-500"
                />
                <input
                  type="number"
                  value={h.weight}
                  onChange={(e) => updateHolding(i, "weight", e.target.value)}
                  step="0.05"
                  min="0"
                  max="1"
                  className="w-24 bg-kairos-bg border border-kairos-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber-500"
                />
                <button onClick={() => removeHolding(i)} className="text-kairos-subtle hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mb-4">
            <button
              onClick={addHolding}
              className="flex items-center gap-1 text-xs text-kairos-subtle hover:text-kairos-text"
            >
              <Plus className="w-3 h-3" /> Add holding
            </button>
            <span className={`text-xs font-mono ${Math.abs(totalWeight - 1) < 0.01 ? "text-emerald-400" : "text-amber-400"}`}>
              Total: {(totalWeight * 100).toFixed(0)}% {Math.abs(totalWeight - 1) < 0.01 ? "✓" : "(will normalise)"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-kairos-subtle block mb-1">Horizon (days)</label>
              <select
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
                className="w-full bg-kairos-bg border border-kairos-border rounded-lg px-2 py-1.5 text-sm"
              >
                {[5, 10, 21, 30, 63, 90].map((h) => (
                  <option key={h} value={h}>{h}d</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-kairos-subtle block mb-1">Confidence Level</label>
              <select
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="w-full bg-kairos-bg border border-kairos-border rounded-lg px-2 py-1.5 text-sm"
              >
                <option value={0.90}>90%</option>
                <option value={0.95}>95%</option>
                <option value={0.99}>99%</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg py-2 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Computing…</> : "Compute Risk"}
          </button>

          {error && (
            <p className="text-red-400 text-xs mt-2">{error}</p>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4 fade-in">
            {/* Key metrics */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: `VaR (${(result.confidence_level * 100).toFixed(0)}%)`, value: formatPct(result.portfolio_var_pct), color: "text-orange-400" },
                { label: "CVaR (Expected Shortfall)", value: formatPct(result.portfolio_cvar_pct), color: "text-red-400" },
                { label: "Expected Return", value: formatPct(result.portfolio_expected_return_pct), color: result.portfolio_expected_return_pct >= 0 ? "text-emerald-400" : "text-red-400" },
                { label: "Worst Case (Q10 all)", value: formatPct(result.portfolio_worst_case_pct), color: "text-red-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-kairos-surface border border-kairos-border rounded-xl p-4">
                  <p className="text-xs text-kairos-subtle mb-1">{label}</p>
                  <p className={`text-xl font-bold font-mono ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Return distribution */}
            <div className="bg-kairos-surface border border-kairos-border rounded-2xl p-4">
              <p className="text-xs text-kairos-subtle uppercase tracking-wide mb-3">
                Portfolio Return Distribution
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={result.scenario_returns.map((r) => ({ r }))}
                  margin={{ top: 0, right: 0, left: -10, bottom: 0 }}
                >
                  <XAxis dataKey="r" tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fill: "#6b7280", fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(1)}%`, "Return"]}
                    contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8, fontSize: 11 }}
                  />
                  <ReferenceLine x={result.portfolio_var_pct} stroke="#ef4444" strokeDasharray="4 2" label={{ value: "VaR", fill: "#ef4444", fontSize: 10 }} />
                  <Bar dataKey="r" radius={[2, 2, 0, 0]}>
                    {result.scenario_returns.map((r, i) => (
                      <Cell key={i} fill={r < result.portfolio_var_pct ? "#ef4444" : r < 0 ? "#f97316" : "#10b981"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Per-asset contributions */}
            <div className="bg-kairos-surface border border-kairos-border rounded-2xl p-4">
              <p className="text-xs text-kairos-subtle uppercase tracking-wide mb-3">Asset Risk Contributions</p>
              <div className="space-y-2">
                {result.asset_contributions.map((a) => (
                  <div key={a.ticker} className="flex items-center gap-3">
                    <span className="w-12 text-xs font-mono font-bold">{a.ticker}</span>
                    <div className="flex-1 h-2 bg-kairos-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${a.weight * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-xs font-mono text-right">{(a.weight * 100).toFixed(0)}%</span>
                    <span className={`w-16 text-xs font-mono text-right ${a.forecast_return_pct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatPct(a.forecast_return_pct, 1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!result && !loading && (
          <div className="bg-kairos-surface border border-dashed border-kairos-border rounded-2xl flex items-center justify-center">
            <div className="text-center p-8">
              <Shield className="w-10 h-10 text-kairos-subtle mx-auto mb-3" />
              <p className="text-kairos-subtle text-sm">Configure your portfolio and click Compute Risk.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
