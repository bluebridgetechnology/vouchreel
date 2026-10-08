import type { UsageDay } from "@/lib/admin/usage";

const W = 600;
const H = 120;

/**
 * Credits held per day of the month: review videos and AI videos stacked. Drawn on the server as
 * plain SVG (no chart library); the numbers are also in a table under "Show the numbers".
 */
export function UsageChart({ days, label }: { days: UsageDay[]; label: string }) {
  const totals = days.map((d) => d.reviewCredits + d.aiCredits);
  const peak = Math.max(1, ...totals);
  const sum = totals.reduce((a, b) => a + b, 0);
  const peakDay = sum === 0 ? null : days[totals.indexOf(Math.max(...totals))];
  const step = W / days.length;
  const bar = step * 0.7;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <span>Credits per day</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-control bg-chart-3" /> Review videos
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-control bg-chart-1" /> AI videos
          </span>
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={sum === 0 ? `No credits used in ${label}` : `Credits used per day in ${label}: ${sum} in total, most on ${peakDay?.day} (${Math.max(...totals)})`}
        className="h-32 w-full"
        preserveAspectRatio="none"
      >
        <line x1="0" y1={H - 0.5} x2={W} y2={H - 0.5} className="stroke-border" strokeWidth="1" />
        {days.map((d, i) => {
          const x = i * step + (step - bar) / 2;
          const review = (d.reviewCredits / peak) * (H - 4);
          const ai = (d.aiCredits / peak) * (H - 4);
          return (
            <g key={d.day}>
              <title>{`${d.day}: ${d.reviewCredits} review, ${d.aiCredits} AI`}</title>
              {review > 0 && <rect x={x} y={H - review} width={bar} height={review} className="fill-chart-3" />}
              {ai > 0 && <rect x={x} y={H - review - ai} width={bar} height={ai} className="fill-chart-1" />}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-text-subtle">
        <span>{days[0]?.day.slice(8)}</span>
        <span>Peak {Math.max(...totals)} credits in a day</span>
        <span>{days[days.length - 1]?.day.slice(8)}</span>
      </div>
      <details className="text-xs text-text-muted">
        <summary className="cursor-pointer">Show the numbers</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="py-1 pr-3 font-medium">Day</th>
                <th className="py-1 pr-3 font-medium">Review</th>
                <th className="py-1 font-medium">AI</th>
              </tr>
            </thead>
            <tbody>
              {days
                .filter((d) => d.reviewCredits + d.aiCredits > 0)
                .map((d) => (
                  <tr key={d.day}>
                    <td className="py-0.5 pr-3 tabular-nums">{d.day}</td>
                    <td className="py-0.5 pr-3 tabular-nums">{d.reviewCredits}</td>
                    <td className="py-0.5 tabular-nums">{d.aiCredits}</td>
                  </tr>
                ))}
              {sum === 0 && (
                <tr>
                  <td colSpan={3} className="py-1">No credits used.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
