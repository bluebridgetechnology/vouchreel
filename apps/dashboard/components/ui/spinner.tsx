import { cn } from "@/lib/utils";

/** Indeterminate spinner for inline use (inside buttons, small panels). */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex">
      <span
        className={cn("size-5 animate-spin rounded-pill border-2 border-border-strong border-t-brand", className)}
        aria-hidden="true"
      />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
