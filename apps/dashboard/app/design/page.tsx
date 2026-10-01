import { ThemeToggle } from "@/components/theme-toggle";
import { Icon } from "@/components/ui/icon";
import { Em } from "@/components/ui/em";

const surfaces = [
  ["canvas", "bg-canvas"],
  ["surface", "bg-surface"],
  ["surface-raised", "bg-surface-raised"],
  ["surface-sunken", "bg-surface-sunken"],
  ["surface-inverse", "bg-surface-inverse"],
] as const;

const brand = [
  ["brand", "bg-brand"],
  ["brand-hover", "bg-brand-hover"],
  ["brand-soft", "bg-brand-soft"],
] as const;

const status = [
  ["success", "bg-success", "bg-success-soft text-success-foreground"],
  ["warning", "bg-warning", "bg-warning-soft text-warning-foreground"],
  ["info", "bg-info", "bg-info-soft text-info-foreground"],
  ["danger", "bg-danger", "bg-danger-soft text-danger-foreground"],
] as const;

const tints = [
  ["tint-pink", "bg-tint-pink"],
  ["tint-lime", "bg-tint-lime"],
  ["tint-peach", "bg-tint-peach"],
  ["tint-cream", "bg-tint-cream"],
] as const;

const charts = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6"];

const type = [
  ["text-display", "Display"],
  ["text-5xl", "Heading 5xl"],
  ["text-4xl", "Heading 4xl"],
  ["text-3xl", "Heading 3xl"],
  ["text-2xl", "Heading 2xl"],
  ["text-xl", "Heading xl"],
  ["text-lg", "Lead text lg"],
  ["text-base", "Body base"],
  ["text-sm", "Body small sm"],
  ["text-xs", "Caption xs"],
  ["text-2xs", "OVERLINE 2XS"],
] as const;

const radii = [
  ["rounded-control", "control"],
  ["rounded-card", "card"],
  ["rounded-panel", "panel"],
  ["rounded-pill", "pill"],
] as const;

const shadows = [
  ["shadow-xs", "xs"],
  ["shadow-card", "card"],
  ["shadow-float", "float"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-2xs font-medium uppercase tracking-widest text-text-subtle">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-14 px-6 py-12">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-3">
          <p className="inline-flex rounded-pill bg-brand-soft px-3 py-1 text-2xs font-medium uppercase tracking-widest text-brand-soft-foreground">
            Design system
          </p>
          <h1 className="text-display font-medium">
            Every token, <Em>one</Em> source.
          </h1>
          <p className="max-w-xl text-base text-text-muted">
            Living reference for colour, type, radius, elevation and icons. Everything here is defined once in
            globals.css. Toggle the theme to check both modes.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Surfaces">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {surfaces.map(([name, cls]) => (
            <div key={name} className={`${cls} h-24 rounded-card border p-3 text-xs ${name === "surface-inverse" ? "text-text-inverse" : "text-text-muted"}`}>
              {name}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Brand">
        <div className="flex flex-wrap gap-3">
          {brand.map(([name, cls]) => (
            <div key={name} className={`${cls} flex h-20 w-40 items-end rounded-card p-3 text-xs ${name === "brand-soft" ? "text-brand-soft-foreground" : "text-text-on-accent"}`}>
              {name}
            </div>
          ))}
          <button className="h-20 rounded-pill bg-brand px-8 text-sm font-medium text-text-on-accent shadow-card transition-colors hover:bg-brand-hover">
            Get started
          </button>
          <button className="h-20 rounded-pill bg-surface-inverse px-8 text-sm font-medium text-text-inverse">
            Watch video
          </button>
        </div>
      </Section>

      <Section title="Status">
        <div className="grid gap-3 sm:grid-cols-4">
          {status.map(([name, solid, soft]) => (
            <div key={name} className="space-y-2 rounded-card border bg-surface p-3">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className={`${solid} size-3 rounded-pill`} />
                {name}
              </div>
              <span className={`${soft} inline-flex rounded-pill px-2.5 py-0.5 text-xs font-medium`}>{name} soft</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Pastel panels">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tints.map(([name, cls]) => (
            <div key={name} className={`${cls} h-28 rounded-panel p-4 text-xs text-tint-foreground`}>
              {name}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Charts">
        <div className="flex gap-2">
          {charts.map((c) => (
            <div key={c} className={`${c} h-12 flex-1 rounded-control`} />
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="divide-y rounded-card border bg-surface px-5">
          {type.map(([cls, label]) => (
            <div key={cls} className="flex items-baseline justify-between gap-6 py-3">
              <span className={`${cls} font-medium`}>{label}</span>
              <code className="shrink-0 font-mono text-xs text-text-subtle">{cls}</code>
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <p className="rounded-card border bg-surface p-5 text-3xl font-medium">
            Turn customer love into <Em>conversions</Em>
          </p>
          <p className="rounded-card border bg-surface p-5 font-mono text-sm text-text-muted">
            vr_live_9f3a2c71e0 · 1,284 views · 32.4%
          </p>
        </div>
      </Section>

      <Section title="Radius and elevation">
        <div className="flex flex-wrap gap-4">
          {radii.map(([cls, label]) => (
            <div key={cls} className={`${cls} flex h-20 w-32 items-center justify-center border bg-surface text-xs text-text-muted`}>
              {label}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-6 rounded-panel bg-surface-sunken p-8">
          {shadows.map(([cls, label]) => (
            <div key={cls} className={`${cls} flex h-20 w-32 items-center justify-center rounded-card bg-surface-raised text-xs text-text-muted`}>
              {label}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Icons (Solar Outline)">
        <div className="flex flex-wrap gap-5 rounded-card border bg-surface p-5 text-text-muted">
          {(["sun", "moon", "monitor", "home-2", "arrow-right", "check-circle", "copy", "palette", "settings", "star", "videocamera-record"] as const).map((n) => (
            <div key={n} className="flex flex-col items-center gap-1.5 text-2xs">
              <Icon name={n} size="lg" className="text-text" />
              {n}
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
