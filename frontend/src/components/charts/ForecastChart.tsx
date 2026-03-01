"use client";

/**
 * ForecastChart — renders historical price + TimesFM probabilistic forecast
 * using TradingView Lightweight Charts for a professional look.
 */

import { useEffect, useRef } from "react";
import type { ForecastResponse } from "@/types";

interface Props {
  data: ForecastResponse;
}

export function ForecastChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Dynamically import to avoid SSR issues with the chart library
    import("lightweight-charts").then(
      ({ createChart, ColorType, LineStyle }) => {
        const container = containerRef.current!;
        container.innerHTML = "";

        const chart = createChart(container, {
          width: container.clientWidth,
          height: 420,
          layout: {
            background: { type: ColorType.Solid, color: "#111827" },
            textColor: "#9ca3af",
          },
          grid: {
            vertLines: { color: "#1f2937" },
            horzLines: { color: "#1f2937" },
          },
          crosshair: { mode: 1 },
          rightPriceScale: { borderColor: "#1f2937" },
          timeScale: {
            borderColor: "#1f2937",
            timeVisible: true,
          },
        });

        const toTime = (d: string): number =>
          Math.floor(new Date(d).getTime() / 1000);

        // ── Historical price (white line)
        const historySeries = chart.addLineSeries({
          color: "#f9fafb",
          lineWidth: 2,
          title: data.ticker,
        });
        historySeries.setData(
          data.history_dates.map((d, i) => ({
            time: toTime(d) as any,
            value: data.history_prices[i],
          }))
        );

        // ── Quantile shaded areas (q10–q90)
        const q10Series = chart.addLineSeries({
          color: "rgba(245,158,11,0.15)",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: "Q10",
        });
        const q90Series = chart.addLineSeries({
          color: "rgba(245,158,11,0.15)",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          title: "Q90",
        });
        const q50Series = chart.addLineSeries({
          color: "#f59e0b",
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          title: "Median Forecast",
        });

        const toForecastData = (values: number[]) =>
          data.forecast_dates.map((d, i) => ({
            time: toTime(d) as any,
            value: values[i],
          }));

        q10Series.setData(toForecastData(data.quantiles.q10));
        q90Series.setData(toForecastData(data.quantiles.q90));
        q50Series.setData(toForecastData(data.quantiles.q50));

        // ── Point forecast (dotted white)
        const pointSeries = chart.addLineSeries({
          color: "#ffffff",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          title: "Point Forecast",
        });
        pointSeries.setData(toForecastData(data.point_forecast));

        chart.timeScale().fitContent();

        // Resize observer
        const ro = new ResizeObserver(() => {
          chart.applyOptions({ width: container.clientWidth });
        });
        ro.observe(container);

        return () => {
          ro.disconnect();
          chart.remove();
        };
      }
    );
  }, [data]);

  return (
    <div className="chart-container p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-bold text-lg text-kairos-text">{data.ticker}</span>
          <span className="ml-2 text-sm text-kairos-subtle">
            {data.horizon}-day probabilistic forecast
          </span>
        </div>
        <div className="flex gap-4 text-xs text-kairos-subtle">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-white inline-block" /> Historical
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-amber-400 inline-block" /> Median Forecast
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-amber-400/40 inline-block border-dashed border-t" /> Q10/Q90
          </span>
        </div>
      </div>
      <div ref={containerRef} className="w-full" />
      {data.used_macro_covariates && (
        <p className="text-xs text-amber-400/70 mt-2">
          ✦ Macro-augmented via XReg ({data.macro_series_used.join(", ")})
        </p>
      )}
    </div>
  );
}
