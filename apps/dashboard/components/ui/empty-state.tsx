import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/lib/icons.generated";
import { cn } from "@/lib/utils";

interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: IconName;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = "videocamera-record", title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center gap-3 rounded-panel border border-dashed bg-surface px-6 py-14 text-center", className)}
      {...props}
    >
      <span className="flex size-12 items-center justify-center rounded-pill bg-brand-soft text-brand-soft-foreground">
        <Icon name={icon} size="lg" />
      </span>
      <h3 className="text-lg font-medium">{title}</h3>
      {description && <p className="max-w-sm text-sm text-text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
