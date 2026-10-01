import { cn } from "@/lib/utils";
import { Card, type CardProps } from "@/components/ui/card";

interface StatProps extends Omit<CardProps, "children"> {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}

/** KPI tile. Numbers use tabular figures so columns of stats align. */
export function Stat({ label, value, hint, className, ...props }: StatProps) {
  return (
    <Card padding="md" className={cn("space-y-2", className)} {...props}>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-3xl font-medium tabular-nums">{value}</p>
      {hint && <p className="text-xs text-text-subtle">{hint}</p>}
    </Card>
  );
}
