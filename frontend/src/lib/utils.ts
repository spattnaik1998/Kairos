import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPct(v: number, decimals = 2): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(decimals)}%`;
}

export function formatPrice(v: number): string {
  return v >= 1000
    ? `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
    : `$${v.toFixed(2)}`;
}

export function formatScore(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

export const SIGNAL_COLORS: Record<string, string> = {
  "STRONG BUY":  "text-emerald-400 bg-emerald-400/10 border-emerald-500/30",
  "BUY":         "text-green-400 bg-green-400/10 border-green-500/30",
  "NEUTRAL":     "text-gray-400 bg-gray-400/10 border-gray-500/30",
  "SELL":        "text-orange-400 bg-orange-400/10 border-orange-500/30",
  "STRONG SELL": "text-red-400 bg-red-400/10 border-red-500/30",
};

export const SIGNAL_ARROW: Record<string, string> = {
  "STRONG BUY":  "↑↑",
  "BUY":         "↑",
  "NEUTRAL":     "→",
  "SELL":        "↓",
  "STRONG SELL": "↓↓",
};
