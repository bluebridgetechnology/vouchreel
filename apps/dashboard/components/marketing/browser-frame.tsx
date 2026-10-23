import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/** A browser window drawn around a demo, so it reads as a real site and not a card. */
export function BrowserFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-panel border bg-surface shadow-float", className)}>
      <div className="flex items-center gap-3 border-b bg-surface-sunken px-4 py-2.5" aria-hidden="true">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-pill bg-border-strong" />
          <span className="size-2.5 rounded-pill bg-border-strong" />
          <span className="size-2.5 rounded-pill bg-border-strong" />
        </span>
        <span className="flex h-7 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-pill bg-surface px-3 text-xs text-text-subtle">
          <Icon name="shield-check" size="sm" />
          <span className="truncate">yourwebsite.com</span>
        </span>
        <span className="hidden w-10 sm:block" />
      </div>
      {children}
    </div>
  );
}
