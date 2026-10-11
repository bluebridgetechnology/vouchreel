import { sparklinePath } from "@/lib/home/format";
import { cn } from "@/lib/utils";

/** A tiny trend line, drawn on the server: no chart library for a shape this small. */
export function Sparkline({ values, className, label }: { values: number[]; className?: string; label?: string }) {
  const w = 120;
  const h = 32;
  const line = sparklinePath(values, w, h);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={cn("h-8 w-full overflow-visible", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={`${line} L${w} ${h} L0 ${h} Z`} className="fill-current opacity-10" />
      <path d={line} className="fill-none stroke-current" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
