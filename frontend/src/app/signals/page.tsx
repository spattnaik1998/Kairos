"use client";

import { useEffect, useState } from "react";
import { Zap, Loader2, RefreshCw, ArrowUpDown } from "lucide-react";
import { getSignals } from "@/lib/api";
import type { SignalItem } from "@/types";
import { formatPct, formatPrice, SIGNAL_COLORS, SIGNAL_ARROW } from "@/lib/utils";

const SECTORS = ["All", "Broad Market", "Technology", "Financials", "Energy",
  "Health Care", "Industrials", "Consumer Staples", "Consumer Discretionary",
  "Utilities", "Real Estate", "Small Cap", "Long-Duration Bonds",
  "Mid-Duration Bonds", "High Yield Credit", "Investment Grade Credit", "Commodities"];

export default function SignalsPage() {
  const [horizon, setHorizon] = useState(30);
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [sector, setSector] = useState("All");
  const [sortKey, setSortKey] = useState<keyof SignalItem>("expected_return_pct");

  const fetchSignals = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSignals(horizon);
      setSignals(data.signals);
      setGeneratedAt(data.generated_at);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? e.message ?? "Failed to fetch signals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSignals();
  }, []);

  const filtered = signals
    .filter((s) => sector === "All" || s.sector === sector)
    .sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return bv - av;
    });

  const signalCounts = {
    buy: signals.filter((s) => s.signal.includes("BUY")).length,
    sell: signals.filter((s) => s.signal.includes("SELL")).length,
    neutral: signals.filter((s) => s.signal === "NEUTRAL").length,
  };

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Zap className="w-7 h-7 text-emerald-400" />
            Signal Engine
          </h1>
          <p className="text-kairos-subtle mt-1">
            Confidence-adjusted mean reversion signals across the ETF universe.
          </p>
          {generatedAt && (
            <p className="text-xs text-kairos-subtle/60 mt-1">
              Generated: {new Date(generatedAt).toLocaleString()}
            </p>
          )}
        </div>
        <button
          onClick={fetchSignals}
          disabled={loading}
          className="flex items-center gap-2 bg-kairos-surface border border-kairos-border hover:border-kairos-muted text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Summary bar */}
      {signals.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-kairos-surface border border-emerald-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{signalCounts.buy}</p>
            <p className="text-xs text-kairos-subtle mt-1">Buy / Strong Buy</p>
          </div>
          <div className="bg-kairos-surface border border-kairos-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-gray-400">{signalCounts.neutral}</p>
            <p className="text-xs text-kairos-subtle mt-1">Neutral</p>
          </div>
          <div className="bg-kairos-surface border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{signalCounts.sell}</p>
            <p className="text-xs text-kairos-subtle mt-1">Sell / Strong Sell</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2">
          <label className="text-xs text-kairos-subtle">Horizon:</label>
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="bg-kairos-bg border border-kairos-border rounded-lg px-2 py-1 text-xs"
          >
            {[5, 10, 21, 30, 63].map((h) => (
              <option key={h} value={h}>{h}d</option>
            ))}
          </select>
          <button
            onClick={fetchSignals}
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold px-3 py-1 rounded-lg disabled:opacity-50"
          >
            Apply
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-kairos-subtle">Sector:</label>
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="bg-kairos-bg border border-kairos-border rounded-lg px-2 py-1 text-xs"
          >
            {SECTORS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-kairos-subtle">Sort by:</label>
          <select
            value={sortKey as string}
            onChange={(e) => setSortKey(e.target.value as keyof SignalItem)}
            className="bg-kairos-bg border border-kairos-border rounded-lg px-2 py-1 text-xs"
          >
            <option value="expected_return_pct">Expected Return</option>
            <option value="confidence">Confidence</option>
            <option value="quantile_spread_pct">Uncertainty</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-5 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <span className="ml-3 text-kairos-subtle">Running TimesFM batch inference…</span>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="bg-kairos-surface border border-kairos-border rounded-2xl overflow-hidden fade-in">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-kairos-border text-kairos-subtle text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Asset</th>
                <th className="text-left px-4 py-3">Sector</th>
                <th className="text-right px-4 py-3">Price</th>
                <th className="text-right px-4 py-3">Median Fcst</th>
                <th className="text-right px-4 py-3">Exp. Return</th>
                <th className="text-right px-4 py-3">Confidence</th>
                <th className="text-right px-4 py-3">Uncertainty</th>
                <th className="text-center px-4 py-3">Signal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr
                  key={s.ticker}
                  className={`border-b border-kairos-border/50 hover:bg-kairos-border/20 transition-colors ${
                    i % 2 === 0 ? "" : "bg-kairos-bg/30"
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold text-kairos-text">{s.ticker}</span>
                    <p className="text-[10px] text-kairos-subtle truncate max-w-[160px]">{s.name}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-kairos-subtle">{s.sector}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{formatPrice(s.current_price)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{formatPrice(s.forecast_median)}</td>
                  <td className={`px-4 py-3 text-right font-mono text-xs font-bold ${
                    s.expected_return_pct >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {formatPct(s.expected_return_pct)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-kairos-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full"
                          style={{ width: `${s.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono">{(s.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-kairos-subtle">
                    ±{s.quantile_spread_pct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${SIGNAL_COLORS[s.signal]}`}>
                      {SIGNAL_ARROW[s.signal]} {s.signal}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length === 0 && signals.length > 0 && (
        <p className="text-center text-kairos-subtle py-10">No signals match the selected filter.</p>
      )}
    </div>
  );
}
