import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

/* Decorative product mock-ups for the landing page. They are static, aria-hidden
   illustrations built from the same primitives and tokens as the real app. */

const days = [
  { d: "Mon", h: 46 },
  { d: "Tue", h: 72 },
  { d: "Wed", h: 38 },
  { d: "Thu", h: 88 },
  { d: "Fri", h: 64 },
  { d: "Sat", h: 30 },
  { d: "Sun", h: 52 },
];

export function BarChartMock({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-full items-end justify-between gap-2", className)}>
      {days.map((x) => (
        <div key={x.d} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
          <div className="flex w-full flex-1 items-end overflow-hidden rounded-pill bg-tint-pink">
            <div className="w-full rounded-pill bg-brand" style={{ height: `${x.h}%` }} />
          </div>
          <span className="text-2xs text-text-subtle">{x.d}</span>
        </div>
      ))}
    </div>
  );
}

/** Feature mock: collection link + live submissions. */
export function CollectMock() {
  return (
    <Card variant="pink" padding="lg" aria-hidden="true">
      <Card padding="md" className="space-y-4">
        <p className="text-sm font-medium">Your collection link</p>
        <div className="flex items-center gap-2 rounded-control border bg-surface-sunken px-3 py-2.5 text-sm">
          <Icon name="link" size="sm" className="text-text-subtle" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-text-muted">vouchreel.com/collect/acme</span>
          <span className="inline-flex items-center gap-1 rounded-pill bg-brand px-3 py-1 text-xs text-text-on-accent">
            <Icon name="copy" size="sm" /> Copy
          </span>
        </div>
        <div className="space-y-2">
          {[
            ["Recording", "info", "Maya is recording…"],
            ["Uploaded", "success", "Daniel sent a 0:48 video"],
            ["New", "brand", "Sarah submitted text"],
          ].map(([label, variant, text]) => (
            <div key={text} className="flex items-center justify-between gap-3 rounded-card bg-surface-sunken px-3 py-2.5 text-xs text-text-muted">
              <span>{text}</span>
              <Badge variant={variant as "info" | "success" | "brand"}>{label}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </Card>
  );
}

/** Feature mock: page-targeting rules. */
export function TargetMock() {
  const rules = [
    ["/pricing", "ROI stories", "success", "Show"],
    ["/product/*", "Feature demos", "success", "Show"],
    ["/blog/*", "Founder stories", "info", "Delay 8s"],
    ["/checkout", "Widget hidden", "danger", "Exclude"],
  ] as const;
  return (
    <Card variant="lime" padding="lg" aria-hidden="true">
      <Card padding="md" className="space-y-3">
        <p className="text-sm font-medium">Page targeting</p>
        {rules.map(([path, story, variant, label]) => (
          <div key={path} className="flex items-center gap-3 rounded-card bg-surface-sunken px-3 py-2.5">
            <code className="font-mono text-xs">{path}</code>
            <span className="flex-1 truncate text-xs text-text-muted">{story}</span>
            <Badge variant={variant}>{label}</Badge>
          </div>
        ))}
      </Card>
    </Card>
  );
}

/** Feature mock: analytics report. */
export function ReportMock() {
  return (
    <Card variant="peach" padding="lg" aria-hidden="true">
      <Card padding="md" className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Activity report</p>
          <Badge variant="success">+18% this week</Badge>
        </div>
        <div className="h-44">
          <BarChartMock />
        </div>
        <div className="grid grid-cols-3 gap-3 border-t pt-4">
          {[
            ["Impressions", "12,480"],
            ["Plays", "3,912"],
            ["Goals", "412"],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-2xs text-text-subtle">{k}</p>
              <p className="text-lg font-medium tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      </Card>
    </Card>
  );
}
