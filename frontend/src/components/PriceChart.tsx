import { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";
import type {
  IChartApi,
  CandlestickSeriesPartialOptions,
  LineData,
  Time,
} from "lightweight-charts";

type Candle = { t: string; o: number; h: number; l: number; c: number; v?: number | null };
type Indicators = { sma20: (number | null)[]; sma50: (number | null)[]; rsi14: (number | null)[] };

export default function PriceChart({
  symbol,
  candles,
  indicators,
  interval,
  showSMA20 = true,
  showSMA50 = true,
  showRSI = true,
  rsiHeight = 360,
}: {
  symbol: string;
  candles: Candle[];
  indicators: Indicators | null;
  interval: "1d" | "1wk" | "1mo";
  showSMA20?: boolean;
  showSMA50?: boolean;
  showRSI?: boolean;
  rsiHeight?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const rsiRef = useRef<HTMLDivElement | null>(null);
  const rsiChartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 420,
      layout: { background: { color: "#ffffff" }, textColor: "#1f2937" },
      grid: { vertLines: { color: "#f3f4f6" }, horzLines: { color: "#f3f4f6" } },
      timeScale: { borderColor: "#e5e7eb" },
      rightPriceScale: { borderColor: "#e5e7eb" },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    } as CandlestickSeriesPartialOptions);
    candleSeries.applyOptions({ lastValueVisible: true, priceLineVisible: true });

    const sma20Series = chart.addLineSeries({ lineWidth: 2 });
    const sma50Series = chart.addLineSeries({ lineWidth: 2 });

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          const w = entry.contentRect.width;
          if (chartRef.current) chartRef.current.applyOptions({ width: w });
          if (rsiChartRef.current) rsiChartRef.current.applyOptions({ width: w });
        }
      }
    });
    ro.observe(containerRef.current);

    const candleData = candles.map((c) => ({
      time: c.t as Time,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
    }));
    candleSeries.setData(candleData);

    const toLine = (arr: (number | null)[]): LineData[] =>
      candles.map((c, i) => {
        const v = arr[i];
        return v == null ? { time: c.t as Time, value: NaN } : { time: c.t as Time, value: v };
      });

    if (indicators) {
      sma20Series.setData(showSMA20 ? toLine(indicators.sma20) : []);
      sma50Series.setData(showSMA50 ? toLine(indicators.sma50) : []);
    }

    chart.timeScale().fitContent();

    let rsiSeries: ReturnType<IChartApi["addLineSeries"]> | null = null;
    if (showRSI && rsiRef.current) {
      const rsiChart = createChart(rsiRef.current, {
        width: rsiRef.current.clientWidth,
        height: rsiHeight,
        layout: { background: { color: "#ffffff" }, textColor: "#4b5563" },
        grid: { vertLines: { color: "#f3f4f6" }, horzLines: { color: "#f3f4f6" } },
        timeScale: { borderColor: "#e5e7eb" },
        rightPriceScale: { borderColor: "#e5e7eb" },
        crosshair: { mode: 0 },
      });
      rsiChartRef.current = rsiChart;

      rsiSeries = rsiChart.addLineSeries({ lineWidth: 2 });

      if (indicators) {
        rsiSeries.setData(toLine(indicators.rsi14));
      }

      const addHLine = (value: number) => {
        rsiSeries!.createPriceLine({
          price: value,
          color: "#9ca3af",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
        });
      };
      addHLine(30);
      addHLine(70);

      rsiChart.timeScale().fitContent();
    }

    return () => {
      ro.disconnect();
      if (rsiChartRef.current) {
        rsiChartRef.current.remove();
        rsiChartRef.current = null;
      }
      chart.remove();
      chartRef.current = null;
    };
  }, [symbol, candles, indicators, showSMA20, showSMA50, showRSI, rsiHeight]);

  const intervalLabel = interval === "1d" ? "Daily" : interval === "1wk" ? "Weekly" : "Monthly";

  return (
    <div className="rounded-2xl border">
      <div className="px-4 py-2 border-b flex items-center justify-between">
        <div className="font-semibold">
          {symbol} — {intervalLabel}
        </div>
        <div className="flex gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-500 inline-block"></span>
            <span>SMA20</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-400 inline-block"></span>
            <span>SMA50</span>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="px-2 pt-2 pb-2" />

      <div className="px-2 pb-4">
        <div ref={rsiRef} />
      </div>
    </div>
  );
}
