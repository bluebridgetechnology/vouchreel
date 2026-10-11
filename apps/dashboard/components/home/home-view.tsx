import Link from "next/link";
import type { HomeData } from "@/lib/home/queries";
import { describeChange, playRate, spotlightSentence } from "@/lib/home/format";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Em } from "@/components/ui/em";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { toggleStyle } from "@/components/ui/toggle";
import { Sparkline } from "./sparkline";
import { SpotlightVideo } from "./spotlight-video";

/**
 * The home page: half showcase, half instrument panel. One focal point at the top (the week's best video,
 * or the setup steps for a new account), the numbers under it in words, and nothing that has nothing to say.
 */
export function HomeView({ data, firstName }: { data: HomeData; firstName: string }) {
  const setupDone = data.checklist.every((s) => s.done);
  // A brand-new account has no numbers yet: a row of zeros says nothing, so the row waits for the first visit
  const hasActivity = Object.values(data.pulse).some((m) => m.current > 0 || m.previous > 0);
  const needsCount =
    data.needs.pending.length + (data.needs.failedUploads > 0 ? 1 : 0) + data.needs.reviewSourceErrors.length + data.needs.limits.length;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-text-muted">Home</p>
          <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
            Welcome back{firstName ? <>, <Em>{firstName}</Em></> : null}
          </h1>
        </div>
        <RangeToggle range={data.range} />
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {data.spotlight ? <Spotlight spotlight={data.spotlight} /> : !setupDone ? <Checklist steps={data.checklist} hero /> : <QuietWeek spaceId={data.spaces[0]?.id} />}
        </div>
        <div className="space-y-4">
          {data.spotlight && !setupDone && <Checklist steps={data.checklist} />}
          {needsCount > 0 ? <NeedsYou needs={data.needs} /> : <AllClear />}
        </div>
      </div>

      {hasActivity && <Pulse pulse={data.pulse} range={data.range} />}

      {data.faces.length > 0 && <Faces faces={data.faces} />}

      <section aria-labelledby="home-spaces" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="home-spaces" className="text-lg font-medium">Your spaces</h2>
          <Link href="/spaces" className={buttonVariants({ variant: "link-muted", size: "bare" })}>
            Manage spaces
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.spaces.map((s) => (
            <Link key={s.id} href={`/spaces/${s.id}/testimonials`} className="group">
              <Card padding="md" interactive className="h-full space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate font-medium">{s.name}</p>
                  <Icon name="alt-arrow-right" size="sm" className="text-text-subtle transition-transform group-hover:translate-x-0.5" />
                </div>
                <Sparkline values={s.series} className="text-brand" label={`Plays per day in ${s.name}`} />
                <p className="text-xs text-text-muted tabular-nums">
                  {s.testimonialCount.toLocaleString("en")} {s.testimonialCount === 1 ? "testimonial" : "testimonials"} · {s.plays.toLocaleString("en")} plays
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function RangeToggle({ range }: { range: 7 | 30 }) {
  return (
    <div className="flex items-center gap-1 self-start rounded-pill border bg-surface p-1 sm:self-auto" role="group" aria-label="Period">
      {([7, 30] as const).map((r) => (
        <Link
          key={r}
          href={r === 7 ? "/dashboard" : "/dashboard?range=30"}
          aria-current={range === r ? "page" : undefined}
          className={cn("rounded-pill px-3 py-1 text-xs font-medium transition-colors", toggleStyle("solid", range === r))}
        >
          {r} days
        </Link>
      ))}
    </div>
  );
}

function Spotlight({ spotlight }: { spotlight: NonNullable<HomeData["spotlight"]> }) {
  const t = spotlight.testimonial;
  const name = t.customerName || "A customer";
  return (
    <Card as="section" variant="inverse" aria-labelledby="home-spotlight" className="grid h-full gap-6 p-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:p-6">
      <SpotlightVideo videoUrl={t.videoUrl} thumbnailUrl={t.thumbnailUrl} platform={t.platform} name={name} />
      <div className="flex flex-col justify-between gap-6">
        <div className="space-y-4">
          <p id="home-spotlight" className="text-xs uppercase tracking-widest text-text-inverse/70">
            Spotlight · this week
          </p>
          {t.quote && (
            <blockquote className="accent-italic text-2xl leading-snug sm:text-3xl">&ldquo;{t.quote}&rdquo;</blockquote>
          )}
          <p className="text-sm text-text-inverse/80">
            {name}
            {t.customerCompany ? `, ${t.customerCompany}` : ""} · {t.spaceName}
          </p>
        </div>
        <div className="space-y-4">
          <p className="text-base leading-relaxed">
            {spotlightSentence({ name: t.customerName, plays: spotlight.plays, convertingViewers: spotlight.convertingViewers, days: 7 })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/spaces/${t.spaceId}/social`} className={buttonVariants({ variant: "primary", size: "sm" })}>
              Share it
            </Link>
            <Link href={`/spaces/${t.spaceId}/analytics`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-text-inverse hover:bg-text-inverse/10")}>
              See how it performs
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Checklist({ steps, hero = false }: { steps: HomeData["checklist"]; hero?: boolean }) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  const pct = done / steps.length;
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <Card as="section" variant="lime" aria-labelledby="home-setup" className={cn("space-y-5", hero ? "h-full p-6 sm:p-8" : "p-5")}>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 56 56" className={cn("shrink-0 -rotate-90", hero ? "size-16" : "size-12")} role="img" aria-label={`${done} of ${steps.length} steps done`}>
          <circle cx="28" cy="28" r={r} className="fill-none stroke-current opacity-15" strokeWidth="6" />
          <circle cx="28" cy="28" r={r} className="fill-none stroke-current" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
        </svg>
        <div>
          <h2 id="home-setup" className={cn("font-medium", hero ? "text-2xl" : "text-base")}>
            {hero ? (
              <>
                Let&apos;s get your first video <Em>on your site</Em>
              </>
            ) : (
              "Finish setting up"
            )}
          </h2>
          <p className="text-sm opacity-80">
            {done} of {steps.length} done
          </p>
        </div>
      </div>
      <ol className="space-y-2">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            <Icon name={s.done ? "check-circle" : "clock-circle"} size="sm" className={s.done ? "" : "opacity-50"} />
            {/* Done steps are struck through, not faded: faded text on the tint fails the contrast rule */}
            <span className={s.done ? "line-through" : ""}>{s.label}</span>
          </li>
        ))}
      </ol>
      {next && (
        <Link href={next.href} className={buttonVariants({ variant: "primary", size: hero ? "md" : "sm" })}>
          {next.label}
          <Icon name="arrow-right" size="sm" />
        </Link>
      )}
    </Card>
  );
}

function QuietWeek({ spaceId }: { spaceId?: string }) {
  return (
    <Card as="section" variant="cream" className="flex h-full flex-col justify-between gap-6 p-6 sm:p-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-medium">
          A <Em>quiet</Em> week
        </h2>
        <p className="max-w-md text-sm opacity-80">
          No videos were played in the last 7 days. If you expected some, check the widget is on the pages people visit.
        </p>
      </div>
      {spaceId && (
        <Link href={`/spaces/${spaceId}/widget`} className={cn(buttonVariants({ variant: "primary", size: "sm" }), "self-start")}>
          Check the widget
        </Link>
      )}
    </Card>
  );
}

function NeedsYou({ needs }: { needs: HomeData["needs"] }) {
  return (
    <Card as="section" padding="md" aria-labelledby="home-needs" className="space-y-4">
      <h2 id="home-needs" className="font-medium">Needs you</h2>
      <ul className="space-y-3 text-sm">
        {needs.pending.map((p) => (
          <li key={p.spaceId}>
            <Link href={`/spaces/${p.spaceId}/collect`} className="flex items-center justify-between gap-3 rounded-control hover:text-brand">
              <span>
                <span className="font-medium tabular-nums">{p.count}</span> new {p.count === 1 ? "submission" : "submissions"} to review in {p.spaceName}
              </span>
              <Icon name="alt-arrow-right" size="sm" className="text-text-subtle" />
            </Link>
          </li>
        ))}
        {needs.pendingThumbnails.length > 0 && (
          <li className="flex -space-x-2" aria-hidden>
            {needs.pendingThumbnails.map((src) => (
              <img key={src} src={src} alt="" className="size-9 rounded-pill border-2 border-surface object-cover" />
            ))}
          </li>
        )}
        {needs.failedUploads > 0 && (
          <li className="text-danger-foreground">
            {needs.failedUploads} {needs.failedUploads === 1 ? "upload" : "uploads"} could not be processed
          </li>
        )}
        {needs.reviewSourceErrors.map((e) => (
          <li key={`${e.spaceId}-${e.name}`}>
            <Link href={`/spaces/${e.spaceId}/reviews`} className="hover:text-brand">
              Reviews from {e.name} stopped updating in {e.spaceName}
            </Link>
          </li>
        ))}
        {needs.limits.map((l) => (
          <li key={l.label}>
            <Link href={l.href} className="flex items-center justify-between gap-3 hover:text-brand">
              <span>
                {l.label}: <span className="tabular-nums">{l.used} of {l.max}</span> used
              </span>
              <span className="text-xs text-brand">Upgrade</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AllClear() {
  return (
    <Card as="section" variant="sunken" padding="md" className="flex items-center gap-3 text-sm text-text-muted">
      <Icon name="check-read" className="text-success" />
      Nothing needs you right now.
    </Card>
  );
}

function Pulse({ pulse, range }: { pulse: HomeData["pulse"]; range: 7 | 30 }) {
  const rate = playRate(pulse.plays.current, pulse.impressions.current);
  const previousRate = playRate(pulse.plays.previous, pulse.impressions.previous);
  const rateSeries = pulse.plays.series.map((p, i) => playRate(p, pulse.impressions.series[i]) ?? 0);
  const items: { label: string; value: string; change: ReturnType<typeof describeChange>; series: number[] }[] = [
    { label: "Seen", value: fmt(pulse.impressions.current), change: describeChange(pulse.impressions.current, pulse.impressions.previous), series: pulse.impressions.series },
    { label: "Played", value: fmt(pulse.plays.current), change: describeChange(pulse.plays.current, pulse.plays.previous), series: pulse.plays.series },
    { label: "Play rate", value: rate === null ? "–" : `${rate}%`, change: rate === null || previousRate === null ? null : describeChange(rate, previousRate), series: rateSeries },
    { label: "Conversions", value: fmt(pulse.conversions.current), change: describeChange(pulse.conversions.current, pulse.conversions.previous), series: pulse.conversions.series },
  ];
  return (
    <Card as="section" aria-labelledby="home-pulse" className="overflow-hidden">
      <h2 id="home-pulse" className="sr-only">
        The last {range} days
      </h2>
      {/* One card split by hairlines (the gap shows the border colour), not four separate tiles */}
      <dl className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="space-y-2 bg-surface p-5">
            <dt className="text-xs text-text-muted">{it.label}</dt>
            <dd className="flex items-baseline justify-between gap-3">
              <span className="text-3xl font-medium tabular-nums">{it.value}</span>
              {it.change && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    it.change.direction === "up" ? "text-success-foreground" : it.change.direction === "down" ? "text-danger-foreground" : "text-text-muted"
                  )}
                >
                  {it.change.text}
                </span>
              )}
            </dd>
            <dd>
              <Sparkline values={it.series} className="text-brand" />
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Faces({ faces }: { faces: HomeData["faces"] }) {
  return (
    <section aria-labelledby="home-faces" className="space-y-3">
      <h2 id="home-faces" className="text-lg font-medium">
        Your <Em>voices</Em>
      </h2>
      <ul className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
        {faces.map((f) => {
          const name = f.customerName || "Customer";
          return (
            <li key={f.id} className="shrink-0">
              <Link href={`/spaces/${f.spaceId}/testimonials`} className="group flex w-20 flex-col items-center gap-2 text-center">
                <span className="rounded-pill bg-gradient-to-tr from-brand to-tint-pink p-0.5 transition-transform group-hover:scale-105">
                  {f.thumbnailUrl ? (
                    <img src={f.thumbnailUrl} alt="" className="size-16 rounded-pill border-2 border-canvas object-cover" />
                  ) : (
                    <span className="flex size-16 items-center justify-center rounded-pill border-2 border-canvas bg-surface-sunken text-lg font-medium">{name.charAt(0).toUpperCase()}</span>
                  )}
                </span>
                <span className="w-full truncate text-xs text-text-muted">{name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const fmt = (n: number) => n.toLocaleString("en");
