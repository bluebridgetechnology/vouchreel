import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";
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

function Person({ initials, name, role, status, tone }: { initials: string; name: string; role: string; status: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface-sunken p-3">
      <span className={cn("flex size-9 items-center justify-center rounded-pill text-xs font-medium text-tint-foreground", tone)}>
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-text-muted">{role}</p>
      </div>
      <Badge variant={status === "Approved" ? "success" : "warning"}>{status}</Badge>
    </div>
  );
}

export function HeroCluster() {
  return (
    <div aria-hidden="true" className="rounded-panel bg-surface-sunken p-4 sm:p-6">
      <div className="grid gap-4 md:grid-cols-[1.1fr_1fr_1fr]">
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Testimonials</p>
            <Badge variant="brand">3 new</Badge>
          </div>
          <div className="space-y-2.5">
            <Person initials="SC" name="Sarah Chen" role="Head of Growth, Acme" status="Approved" tone="bg-tint-pink" />
            <Person initials="MO" name="Maya Okafor" role="Founder, Bloom" status="Pending" tone="bg-tint-lime" />
            <Person initials="DR" name="Daniel Reyes" role="Marketing Lead" status="Approved" tone="bg-tint-peach" />
          </div>
        </Card>

        <Card padding="md" className="flex flex-col gap-4">
          <p className="text-sm font-medium">Activity report</p>
          <div className="h-36 flex-1">
            <BarChartMock />
          </div>
          <div className="flex items-end justify-between border-t pt-3">
            <div>
              <p className="text-2xs text-text-subtle">Plays</p>
              <p className="text-xl font-medium tabular-nums">1,284</p>
            </div>
            <div className="text-right">
              <p className="text-2xs text-text-subtle">Avg watch</p>
              <p className="text-xl font-medium tabular-nums">0:42</p>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card padding="md" className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-control bg-tint-pink text-tint-foreground">
                <Icon name="tag" />
              </span>
              <div>
                <p className="text-sm font-medium">Pricing page</p>
                <p className="text-xs text-text-muted">ROI stories</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Conversion goal</span>
              <span className="tabular-nums">75%</span>
            </div>
            <Progress value={75} />
          </Card>
          <Card padding="md" className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-control bg-tint-lime text-tint-foreground">
                <Icon name="global" />
              </span>
              <div>
                <p className="text-sm font-medium">Homepage</p>
                <p className="text-xs text-text-muted">Founder stories</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>Conversion goal</span>
              <span className="tabular-nums">50%</span>
            </div>
            <Progress value={50} />
          </Card>
        </div>
      </div>
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
