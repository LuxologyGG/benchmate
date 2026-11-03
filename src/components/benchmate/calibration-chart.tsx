"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";
import type { AgentResult } from "@/lib/types";

export function CalibrationChart({
  series,
}: {
  series: NonNullable<AgentResult["chartSeries"]>[number];
}) {
  const points = series.points.map((p) => ({ x: p.x, y: p.y, label: p.label }));
  const fit = series.fit;
  const fitLine = fit
    ? (() => {
        const xs = points.map((p) => p.x);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        return [
          { x: minX, yFit: fit.slope * minX + fit.intercept },
          { x: maxX, yFit: fit.slope * maxX + fit.intercept },
        ];
      })()
    : [];

  const merged = [
    ...points.map((p) => ({ ...p, yFit: undefined as number | undefined })),
    ...fitLine.map((p) => ({
      x: p.x,
      y: undefined as number | undefined,
      yFit: p.yFit,
      label: undefined as string | undefined,
    })),
  ].sort((a, b) => a.x - b.x);

  return (
    <div className="h-72 w-full" data-testid="calibration-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={merged} margin={{ top: 12, right: 16, bottom: 12, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.1)" />
          <XAxis
            dataKey="x"
            type="number"
            name="Concentration"
            unit=" M"
            tick={{ fontSize: 11, fill: "oklch(0.62 0.02 145)" }}
            label={{
              value: "Concentration (M)",
              position: "insideBottom",
              offset: -4,
              fontSize: 11,
              fill: "oklch(0.62 0.02 145)",
            }}
          />
          <YAxis
            type="number"
            tick={{ fontSize: 11, fill: "oklch(0.62 0.02 145)" }}
            label={{
              value: "Absorbance",
              angle: -90,
              position: "insideLeft",
              fontSize: 11,
              fill: "oklch(0.62 0.02 145)",
            }}
          />
          <Tooltip
            contentStyle={{
              background: "oklch(0.14 0.006 145)",
              border: "1px solid oklch(1 0 0 / 0.12)",
              fontFamily: "monospace",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              typeof value === "number" ? value.toPrecision(4) : value,
              name === "y" ? "Measured" : "Fit",
            ]}
          />
          <Legend />
          <Scatter name="Standards" dataKey="y" fill="oklch(0.88 0.19 125)" />
          {fit && (
            <Line
              type="linear"
              dataKey="yFit"
              name={`Fit (R²=${fit.rSquared.toFixed(3)})`}
              stroke="oklch(0.75 0.08 145)"
              dot={false}
              strokeWidth={1.5}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
      {fit && (
        <p className="mt-2 text-center font-mono text-xs text-muted-foreground">
          {fit.equation}
        </p>
      )}
    </div>
  );
}
