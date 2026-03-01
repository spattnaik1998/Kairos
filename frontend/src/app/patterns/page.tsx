"use client";

import { useState } from "react";
import { Clock, Loader2, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { getAnalogues } from "@/lib/api";
import type { PatternAnalogueResponse, AnalogueResult } from "@/types";
import { formatPct } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend,
} from "recharts";

const RANK_COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6"];

function AnalogueCard({ a, color }: { a: AnalogueResult; color: string }) {
  const spxPositive = a.spx_return_90d >= 0;
  const vixUp = a.vix_change_90d >= 0;

  return (
    <div className="bg-kairos-surface border border-kairos-border rounded-2xl p-5 fade-in">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{ background: `${color}20`, color }}
            >
              #{a.rank} Match
            </span>
            <span className="text-xs text-kairos-subtle">
              {(a.similarity_score * 100).toFixed(1)}% similar
            </span>
          </div>
          <h3 className="font-semibold text-kairos-text">{a.label}</h3>
          <p className="text-xs text-kairos-subtle">
            {a.start_date} → {a.end_date}
          </p>
        </div>
      </div>

      {/* Outcome grid */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-kairos-bg rounded-lg p-3 text-center">
          <p className="text-[10px] text-kairos-subtle mb-1">SPX (90d after)</p>
          <div className="flex items-center justify-center gap-1">
            {spxPositive ? (
              <TrendingUp className="w-3 h-3 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-400" />
            )}
            <span className={`text-sm font-bold font-mono ${spxPositive ? "text-emerald-400" : "text-red-400"}`}>
              {formatPct(a.spx_return_90d, 1)}
            </span>
          </div>
        </div>
        <div className="bg-kairos-bg rounded-lg p-3 text-center">
          <p className="text-[10px] text-kairos-subtle mb-1">Bonds (90d after)</p>
          <span className={`text-sm font-bold font-mono ${a.bond_return_90d >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {formatPct(a.bond_return_90d, 1)}
          </span>
        </div>
        <div className="bg-kairos-bg rounded-lg p-3 text-center">
          <p className="text-[10px] text-kairos-subtle mb-1">VIX Δ (90d after)</p>
          <span className={`text-sm font-bold font-mono ${vixUp ? "text-red-400" : "text-emerald-400"}`}>
            {a.vix_change_90d > 0 ? "+" : ""}{a.vix_change_90d.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PatternsPage() {
  const [lookback, setLookback] = useState(126);
  const [nAnalogues, setNAnalogues] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PatternAnalogueResponse | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAnalogues({
        lookback_days: lookback,
        n_analogues: nAnalogues,
        fingerprint_series: ["SPY", "^VIX", "TLT", "GLD", "HYG"],
      });
      setResult(data);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? e.message ?? "Pattern search failed");
    } finally {
      setLoading(false);
    }
  };

  // Build chart data: current window + analogues overlaid
  const chartData = result
    ? result.current_fingerprint_normalized.map((val, i) => {
        const entry: Record<string, number> = { i, current: val };
        result.analogues.forEach((a) => {
          if (a.fingerprint_normalized[i] !== undefined) {
            entry[`analogue_${a.rank}`] = a.fingerprint_normalized[i];
          }
        });
        return entry;
      })
    : [];

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Clock className="w-7 h-7 text-rose-400" />
          Temporal Pattern Library
        </h1>
        <p className="text-kairos-subtle mt-1">
          Find historical market periods that most closely resemble the current environment.
          Uses TimesFM&apos;s 16,384-step context window + cosine similarity across normalised market fingerprints.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-kairos-surface border border-kairos-border rounded-2xl p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-kairos-subtle mb-1 uppercase tracking-wide">
              Lookback Window
            </label>
            <select
              value={lookback}
              onChange={(e) => setLookback(Number(e.target.value))}
              className="w-full bg-kairos-bg border border-kairos-border rounded-lg px-3 py-2 text-sm"
            >
              <option value={63}>63 days (~3 months)</option>
              <option value={126}>126 days (~6 months)</option>
              <option value={252}>252 days (~1 year)</option>
              <option value={504}>504 days (~2 years)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-kairos-subtle mb-1 uppercase tracking-wide">
              Number of Analogues
            </label>
            <select
              value={nAnalogues}
              onChange={(e) => setNAnalogues(Number(e.target.value))}
              className="w-full bg-kairos-bg border border-kairos-border rounded-lg px-3 py-2 text-sm"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg py-2 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Searching…</>
              ) : (
                "Find Analogues"
              )}
            </button>
          </div>
        </div>
        <p className="text-xs text-kairos-subtle mt-3 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Fingerprint series: SPY, VIX, TLT (Bonds), GLD (Gold), HYG (Credit).
          First search fetches ~10 years of data — may take 30–60s.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-rose-400 animate-spin mx-auto mb-3" />
            <p className="text-kairos-subtle">Scanning 10 years of market history…</p>
            <p className="text-xs text-kairos-subtle/60 mt-1">
              Comparing {lookback}-day temporal fingerprints via cosine similarity
            </p>
          </div>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-6 fade-in">
          {/* Interpretation */}
          <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5">
            <p className="text-sm text-rose-200 leading-relaxed">{result.interpretation}</p>
          </div>

          {/* Overlay chart */}
          {chartData.length > 0 && (
            <div className="bg-kairos-surface border border-kairos-border rounded-2xl p-5">
              <p className="text-sm font-semibold mb-1">Normalised SPY Pattern Overlay</p>
              <p className="text-xs text-kairos-subtle mb-4">
                Current {lookback}-day window vs. top historical analogues (z-score normalised)
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <XAxis dataKey="i" hide />
                  <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} tickFormatter={(v) => v.toFixed(1)} />
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 8, fontSize: 11 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    dataKey="current"
                    name="Current"
                    stroke="#f9fafb"
                    strokeWidth={2}
                    dot={false}
                  />
                  {result.analogues.map((a, i) => (
                    <Line
                      key={a.rank}
                      dataKey={`analogue_${a.rank}`}
                      name={a.label}
                      stroke={RANK_COLORS[i]}
                      strokeWidth={1.5}
                      strokeDasharray="6 3"
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Analogue cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {result.analogues.map((a, i) => (
              <AnalogueCard key={a.rank} a={a} color={RANK_COLORS[i]} />
            ))}
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="bg-kairos-surface border border-dashed border-kairos-border rounded-2xl p-16 text-center">
          <Clock className="w-12 h-12 text-kairos-subtle mx-auto mb-3" />
          <p className="text-kairos-subtle">Click &quot;Find Analogues&quot; to search historical market patterns.</p>
          <p className="text-xs text-kairos-subtle/60 mt-2">
            Leverages TimesFM&apos;s 16k context window to look back up to 10 years.
          </p>
        </div>
      )}
    </div>
  );
}
