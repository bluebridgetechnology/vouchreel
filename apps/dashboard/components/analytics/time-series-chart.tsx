"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { chartColors, chartTheme } from "@/lib/chart-theme";

export interface TimeSeriesPoint {
  date: string;
  impressions: number;
  plays: number;
}

interface TimeSeriesChartProps {
  points: TimeSeriesPoint[];
}

function formatLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function TimeSeriesChart({ points }: TimeSeriesChartProps) {
  const data = points.map((p) => ({ ...p, label: formatLabel(p.date) }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid {...chartTheme.grid} />
          <XAxis dataKey="label" {...chartTheme.axis} minTickGap={24} />
          <YAxis {...chartTheme.axis} allowDecimals={false} />
          <Tooltip {...chartTheme.tooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="impressions"
            name="Impressions"
            stroke={chartColors[0]}
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="plays"
            name="Plays"
            stroke={chartColors[1]}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
