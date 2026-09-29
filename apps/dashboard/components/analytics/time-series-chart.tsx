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
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border, #e5e7eb)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid var(--border, #e5e7eb)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="impressions"
            name="Impressions"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="plays"
            name="Plays"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
