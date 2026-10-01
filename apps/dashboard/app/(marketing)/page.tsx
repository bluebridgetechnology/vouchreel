import Link from "next/link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Em } from "@/components/ui/em";
import { Icon } from "@/components/ui/icon";
import { Container, Section } from "@/components/ui/layout";
import type { IconName } from "@/lib/icons.generated";
import { cn } from "@/lib/utils";
import { CollectMock, HeroCluster, ReportMock, TargetMock } from "@/components/marketing/mocks";

export const metadata: Metadata = {
  title: { absolute: "Vouchreel — Turn customer love into conversions" },
  description:
    "Collect video testimonials with one link, customize a lightweight widget, and embed social proof anywhere. Contextual matching, smart triggers, and conversion tracking built in.",
  alternates: { canonical: "/" },
};

const stats = [
  ["< 10 KB", "Embed script, gzipped"],
  ["Zero", "Layout shift on your site"],
  ["Minutes", "From signup to live"],
  ["Free", "Plan to get started"],
];

const steps = [
  {
    title: "Paste a video link",
    description: "Add YouTube, Vimeo, or MP4 testimonials from happy customers. No editing or hosting required.",
    tint: "pink",
  },
  {
    title: "Customize your widget",
    description: "Pick a theme and position, choose when it appears, and decide which pages show which stories.",
    tint: "lime",
  },
  {
    title: "Embed anywhere",
    description: "Drop one async script tag on your site. The widget loads in milliseconds and never blocks your page.",
    tint: "peach",
  },
] as const;

const features: { title: string; description: string; icon: IconName }[] = [
  {
    title: "Contextual matching",
    description: "Match by path, tags, or campaigns so every visitor sees the most relevant story.",
    icon: "tag",
  },
  {
    title: "Smart triggers",
    description: "Reveal proof after a delay, on scroll depth, or after repeat visits, and never after a dismissal.",
    icon: "clock-circle",
  },
  {
    title: "Conversion tracking",
    description: "Watch impressions, plays, and clicks turn into goal completions with built-in funnels.",
    icon: "chart-square",
  },
  {
    title: "Page targeting",
    description: "Include or exclude any path. Keep the widget off checkout, or run campaigns on landing pages.",
    icon: "global",
  },
  {
    title: "Feather-light embed",
    description: "A single async script under 10 KB gzipped, with fixed positioning and no layout shift.",
    icon: "bolt",
  },
  {
    title: "Privacy-friendly analytics",
    description: "First-party event tracking with no third-party cookies, so you see what works.",
    icon: "shield-check",
  },
];

const rows = [
  {
    eyebrow: "Collect",
    title: (
      <>
        Collect stories with <Em>one link</Em>
      </>
    ),
    body: "Send customers a single link. They record on their phone or upload a video, and it lands in your inbox ready to approve. No accounts, no downloads, no back-and-forth.",
    bullets: ["Record in the browser or upload", "Optional incentives and custom prompts", "Approve, edit, or reject in one click"],
    mock: <CollectMock />,
  },
  {
    eyebrow: "Match",
    title: (
      <>
        Show the <Em>right story</Em> on the right page
      </>
    ),
    body: "Visitors on your pricing page see ROI stories. Visitors on your blog see founder stories. Set the rules once and the widget does the rest.",
    bullets: ["Path, tag, and campaign matching", "Delay, scroll, and repeat-visit triggers", "Exclude checkout and admin pages"],
    mock: <TargetMock />,
  },
  {
    eyebrow: "Measure",
    title: (
      <>
        Track real-time <Em>conversions</Em>
      </>
    ),
    body: "See which testimonials get played, which get clicked, and which actually close the sale. Run A/B tests and export reports for your team.",
    bullets: ["Per-testimonial plays and goals", "A/B experiments with winner rollout", "Exportable executive reports"],
    mock: <ReportMock />,
  },
];

const quotes = [
  {
    quote: "The contextual matching is the killer feature. Pricing page visitors see ROI stories, not random praise.",
    name: "Founder",
    company: "E-commerce",
  },
  {
    quote: "One script tag, zero layout shift, and the analytics finally told us which stories actually sell.",
    name: "Marketing Lead",
    company: "Agency",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <Section className="pb-12 pt-16 sm:pt-24">
        <Container>
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="eyebrow">Video testimonials, embedded in minutes</Badge>
            <h1 className="mt-6 text-display font-medium">
              Turn customer love into <Em>conversions</Em>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted">
              Vouchreel collects your customers&apos; video testimonials and shows the right story to the right visitor,
              automatically. No editing, no code, no layout shift.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="xl">
                <Link href="/signup">
                  Get started <Icon name="arrow-right" size="sm" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="ink">
                <Link href="/#how-it-works">
                  <Icon name="play-circle" /> See how it works
                </Link>
              </Button>
            </div>
            <p className="mt-5 text-xs text-text-subtle">No credit card needed · Free plan, cancel anytime</p>
          </div>

          <div className="mt-16">
            <HeroCluster />
          </div>
        </Container>
      </Section>

      {/* Stats strip */}
      <Container>
        <Card variant="sunken" className="rounded-panel px-6 py-10 sm:px-10">
          <dl className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {stats.map(([value, label]) => (
              <div key={label}>
                <dd className="text-4xl font-medium tracking-tight">{value}</dd>
                <dt className="mt-1 text-sm text-text-muted">{label}</dt>
              </div>
            ))}
          </dl>
        </Card>
      </Container>

      {/* How it works */}
      <Section id="how-it-works">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-medium sm:text-5xl">
              Live in <Em>three</Em> steps
            </h2>
            <p className="mt-4 text-text-muted">
              From raw customer video to embedded social proof, without touching your codebase.
            </p>
          </div>
          <ol className="mt-14 grid gap-5 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title}>
                <Card variant={step.tint} padding="lg" className="h-full">
                  <span className="flex size-11 items-center justify-center rounded-pill bg-surface text-lg font-medium text-text shadow-sm">
                    {i + 1}
                  </span>
                  <h3 className="mt-8 text-2xl font-medium">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed opacity-70">{step.description}</p>
                </Card>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      {/* Features grid */}
      <Section id="features" className="pt-0">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-medium sm:text-5xl">
              Social proof that does the <Em>selling</Em>
            </h2>
            <p className="mt-4 text-text-muted">
              Everything you need to collect, target, and measure video testimonials. Nothing you don&apos;t.
            </p>
          </div>
          <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li key={f.title}>
                <Card interactive padding="md" className="h-full">
                  <span className="flex size-11 items-center justify-center rounded-control bg-brand-soft text-brand-soft-foreground">
                    <Icon name={f.icon} />
                  </span>
                  <h3 className="mt-6 text-lg font-medium">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">{f.description}</p>
                </Card>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Alternating feature rows */}
      <Section className="pt-0">
        <Container className="space-y-24 sm:space-y-32">
          {rows.map((row, i) => (
            <div key={row.eyebrow} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div className={cn("min-w-0", i % 2 === 1 && "lg:order-2")}>{row.mock}</div>
              <div className={cn("min-w-0", i % 2 === 1 && "lg:order-1")}>
                <Badge variant="eyebrow">{row.eyebrow}</Badge>
                <h2 className="mt-5 text-4xl font-medium sm:text-5xl">{row.title}</h2>
                <p className="mt-5 text-text-muted">{row.body}</p>
                <ul className="mt-6 space-y-3 text-sm">
                  {row.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-3">
                      <Icon name="check-circle" size="sm" className="text-success" />
                      {b}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="mt-8">
                  <Link href="/signup">
                    Learn more <Icon name="arrow-right" size="sm" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </Container>
      </Section>

      {/* Testimonial band */}
      <section className="bg-surface-inverse py-(--space-section) text-text-inverse">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="bg-text-inverse/10 text-text-inverse">What teams say</Badge>
            <blockquote className="mt-8 text-3xl font-medium leading-snug sm:text-4xl">
              &ldquo;We replaced three static testimonial screenshots with Vouchreel and our demo-page conversion rate
              went up within a <Em>month</Em>.&rdquo;
            </blockquote>
            <p className="mt-6 text-sm opacity-70">Head of Growth, B2B SaaS</p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {quotes.map((q) => (
              <figure key={q.quote} className="rounded-panel border border-text-inverse/15 p-7">
                <blockquote className="text-base leading-relaxed opacity-90">&ldquo;{q.quote}&rdquo;</blockquote>
                <figcaption className="mt-5 text-sm opacity-60">
                  {q.name}, {q.company}
                </figcaption>
              </figure>
            ))}
          </div>
        </Container>
      </section>

      {/* Pricing teaser */}
      <Section id="pricing">
        <Container>
          <Card variant="sunken" className="grid items-center gap-8 rounded-panel p-8 sm:p-12 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <Badge variant="eyebrow">Pricing</Badge>
              <h2 className="mt-5 text-4xl font-medium sm:text-5xl">
                Simple, <Em>transparent</Em> pricing
              </h2>
              <p className="mt-4 max-w-xl text-text-muted">
                Start free and upgrade when your testimonial wall starts paying for itself. Paid plans include a 14-day
                money-back guarantee.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Free plan for your first spaces and testimonials",
                  "Higher limits, more spaces, and team features as you grow",
                  "Cancel anytime, no long-term contracts",
                ].map((t) => (
                  <li key={t} className="flex items-center gap-3">
                    <Icon name="check-circle" size="sm" className="text-success" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <Button asChild size="lg">
                <Link href="/pricing">View pricing</Link>
              </Button>
              <p className="max-w-xs text-xs text-text-subtle lg:text-right">
                Pay by card via Stripe, or choose local payment methods via Dodo Payments.
              </p>
            </div>
          </Card>
        </Container>
      </Section>

      {/* Final CTA */}
      <Section className="pt-0">
        <Container>
          <Card variant="peach" padding="lg" className="px-6 py-16 text-center sm:py-24">
            <h2 className="mx-auto max-w-3xl text-4xl font-medium sm:text-5xl">
              Your happiest customers are your best <Em>salespeople</Em>
            </h2>
            <p className="mx-auto mt-5 max-w-xl opacity-70">
              Give them a stage. Collect their story, embed it on your site, and watch it work.
            </p>
            <Button asChild size="xl" variant="ink" className="mt-9">
              <Link href="/signup">
                Get started free <Icon name="arrow-right" size="sm" />
              </Link>
            </Button>
          </Card>
        </Container>
      </Section>
    </>
  );
}
