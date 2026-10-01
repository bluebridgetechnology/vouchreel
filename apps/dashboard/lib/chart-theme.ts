/** Recharts accepts CSS variable strings, so charts follow the active theme. */
export const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

export const chartTheme = {
  grid: { stroke: "var(--border)", strokeDasharray: "3 3", vertical: false },
  axis: {
    stroke: "var(--border-strong)",
    tick: { fill: "var(--text-subtle)", fontSize: 11, fontFamily: "var(--font-jetbrains-mono)" },
    tickLine: false,
    axisLine: false,
  },
  tooltip: {
    contentStyle: {
      background: "var(--surface-raised)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-control)",
      boxShadow: "var(--shadow-float)",
      color: "var(--text)",
      fontSize: 12,
    },
    cursor: { fill: "var(--surface-sunken)" },
  },
} as const;
