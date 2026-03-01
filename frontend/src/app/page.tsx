"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp, Zap, Shield, Clock,
  Activity, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { getMacroSnapshot } from "@/lib/api";
import type { MacroSnapshot } from "@/types";
import { formatPct } from "@/lib/utils";

const FEATURE_CARDS = [
  {
    href: "/forecast",
    icon: TrendingUp,
    color: "amber",
    title: "Asset Forecast",
    desc: "Probabilistic price forecasts with full quantile bands (10th–90th percentile) via TimesFM 2.5.",
    cta: "Forecast an asset →",
  },
  {
    href: "/signals",
    icon: Zap,
    color: "green",
    title: "Signal Engine",
    desc: "Ranked buy/sell signals across 20+ ETFs, driven by confidence-adjusted expected returns.",
    cta: "View signals →",
  },
  {
    href: "/portfolio",
    icon: Shield,
    color: "purple",
    title: "Portfolio Risk",
    desc: "Compute VaR, CVaR and scenario P&L directly from quantile forecasts — no Monte Carlo needed.",
    cta: "Analyse risk →",
  },
  {
    href: "/patterns",
    icon: Clock,
    color: "rose",
    title: "Pattern Library",
    desc: "Find which historical market periods most closely resemble today using temporal fingerprinting.",
    cta: "Find analogues →",
  },
];

const COLOR_MAP: Record<string, string> = {
  amber:  "bg-amber-500/10 border-amber-500/20 text-amber-400",
  green:  "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
  rose:   "bg-rose-500/10 border-rose-500/20 text-rose-400",
};

function MacroTile({
  label,
  value,
  unit = "",
  up = true,
}: {
  label: string;
  value: number | null;
  unit?: string;
  up?: boolean;
}) {
  if (value === null)
    return (
      <div className="bg-kairos-surface border border-kairos-border rounded-xl p-4">
        <p className="text-xs text-kairos-subtle mb-1">{label}</p>
        <div className="skeleton h-6 w-20" />
      </div>
    );

  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="bg-kairos-surface border border-kairos-border rounded-xl p-4 fade-in">
      <p className="text-xs text-kairos-subtle mb-1">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-xl font-bold font-mono">
          {value.toFixed(2)}
          <span className="text-sm font-normal text-kairos-subtle ml-1">{unit}</span>
        </p>
        <Icon className={`w-4 h-4 mb-1 ${up ? "text-emerald-400" : "text-red-400"}`} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [macro, setMacro] = useState<MacroSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMacroSnapshot()
      .then(setMacro)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-8 py-8 max-w-6xl">
      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-kairos-subtle uppercase tracking-widest">
            Live · TimesFM 2.5 Online
          </span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Kairos{" "}
          <span className="text-amber-400">Intelligence</span>
        </h1>
        <p className="text-kairos-subtle text-lg max-w-2xl">
          Macro-aware probabilistic forecasting powered by Google DeepMind&apos;s TimesFM — a
          200M-parameter decoder-only foundation model trained on 100 billion real-world time points.
        </p>
      </div>

      {/* Macro Snapshot */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-kairos-subtle mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Macro Snapshot
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MacroTile
            label="Yield Curve (10Y-2Y)"
            value={macro?.yield_curve_slope ?? null}
            unit="bps"
            up={(macro?.yield_curve_slope ?? 0) > 0}
          />
          <MacroTile label="VIX" value={macro?.vix ?? null} up={false} />
          <MacroTile label="CPI YoY" value={macro?.cpi_yoy ?? null} unit="%" up={false} />
          <MacroTile label="Unemployment" value={macro?.unemployment_rate ?? null} unit="%" up={false} />
          <MacroTile label="Fed Funds" value={macro?.fed_funds_rate ?? null} unit="%" up={false} />
          <MacroTile label="HY Spread" value={macro?.credit_spread_hy ?? null} unit="bps" up={false} />
        </div>
      </section>

      {/* Feature Cards */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-kairos-subtle mb-4">
          Platform Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURE_CARDS.map(({ href, icon: Icon, color, title, desc, cta }) => (
            <Link
              key={href}
              href={href}
              className="group bg-kairos-surface border border-kairos-border rounded-2xl p-6 hover:border-kairos-muted transition-all hover:-translate-y-0.5"
            >
              <div
                className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border ${COLOR_MAP[color]} mb-4`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-kairos-text mb-2">{title}</h3>
              <p className="text-sm text-kairos-subtle leading-relaxed mb-4">{desc}</p>
              <span className="text-sm font-medium text-amber-400 group-hover:underline">{cta}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Model Info */}
      <section className="mt-10 bg-kairos-surface border border-kairos-border rounded-2xl p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-kairos-subtle mb-4">
          About TimesFM 2.5
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {[
            { label: "Parameters",    value: "200M" },
            { label: "Context Window", value: "16,384 steps" },
            { label: "Training Data",  value: "100B time points" },
            { label: "Quantile Heads", value: "10th–90th pct" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-kairos-bg rounded-xl p-4">
              <p className="text-xl font-bold font-mono text-amber-400">{value}</p>
              <p className="text-xs text-kairos-subtle mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
