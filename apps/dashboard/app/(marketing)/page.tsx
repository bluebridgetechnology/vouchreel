import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Vouchreel — Turn customer love into conversions" },
  description:
    "Collect video testimonials with one link, customize a lightweight widget, and embed social proof anywhere. Contextual matching, smart triggers, and conversion tracking built in.",
  alternates: { canonical: "/" },
};

const steps = [
  {
    title: "Paste a video link",
    description:
      "Add YouTube, Vimeo, or MP4 testimonials from happy customers — no editing or hosting required.",
  },
  {
    title: "Customize your widget",
    description:
      "Pick a theme and position, choose when it appears, and decide which pages show which stories.",
  },
  {
    title: "Embed anywhere",
    description:
      "Drop one async script tag on your site. The widget loads in milliseconds and never blocks your page.",
  },
];

const features = [
  {
    title: "Contextual matching",
    description:
      "Show the testimonial that fits the page — match by path, tags, or campaigns so every visitor sees the most relevant story.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z"
      />
    ),
  },
  {
    title: "Smart triggers",
    description:
      "Reveal social proof at the right moment: after a delay, on scroll depth, after repeat visits, or not at all if dismissed.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    ),
  },
  {
    title: "Conversion tracking",
    description:
      "Watch impressions, plays, and clicks turn into goal completions with built-in funnels and per-testimonial stats.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
      />
    ),
  },
  {
    title: "Page targeting",
    description:
      "Include or exclude any path. Keep the widget off checkout and admin pages, or run campaigns on specific landing pages.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"
      />
    ),
  },
  {
    title: "Feather-light embed",
    description:
      "A single script under 10 KB gzipped. Async loading and fixed positioning mean zero layout shift on your site.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
      />
    ),
  },
  {
    title: "Privacy-friendly analytics",
    description:
      "First-party event tracking with no third-party cookies — see what works without compromising your visitors.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
      />
    ),
  },
];

const quotes = [
  {
    quote:
      "We replaced three static testimonial screenshots with Vouchreel and our demo-page conversion rate went up within a month.",
    name: "Head of Growth",
    company: "B2B SaaS",
  },
  {
    quote:
      "The contextual matching is the killer feature — pricing page visitors see ROI stories, not random praise.",
    name: "Founder",
    company: "E-commerce",
  },
  {
    quote:
      "One script tag, zero layout shift, and the analytics finally told us which stories actually sell.",
    name: "Marketing Lead",
    company: "Agency",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-muted/60 via-background to-background"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Video testimonials, embedded in minutes
            </p>
            <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Turn customer love into conversions
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Vouchreel collects your customers&apos; video testimonials and
              shows the right story to the right visitor — automatically.
              No editing, no code, no layout shift.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Start free
              </Link>
              <Link
                href="/#how-it-works"
                className="inline-flex h-11 items-center justify-center rounded-lg border bg-background px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                See how it works
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-6 border-t pt-6 text-sm">
              <div>
                <dt className="text-muted-foreground">Script size</dt>
                <dd className="mt-1 text-xl font-semibold">&lt; 10 KB</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Setup time</dt>
                <dd className="mt-1 text-xl font-semibold">Minutes</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Layout shift</dt>
                <dd className="mt-1 text-xl font-semibold">Zero</dd>
              </div>
            </dl>
          </div>

          {/* Product mock */}
          <div aria-hidden="true" className="relative">
            <div className="overflow-hidden rounded-2xl border bg-card shadow-xl">
              <div className="flex items-center gap-1.5 border-b bg-muted/50 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-3 h-5 flex-1 rounded-md border bg-background" />
              </div>
              <div className="relative space-y-3 p-6 pb-32">
                <div className="h-3 w-2/3 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
                <div className="h-28 rounded-lg bg-muted/60" />
                <div className="h-3 w-3/5 rounded bg-muted" />
                <div className="h-3 w-2/5 rounded bg-muted" />
                <div className="absolute bottom-5 right-5 w-72 rounded-xl border bg-background p-4 shadow-lg">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      SC
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">Sarah Chen</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Head of Growth, Acme
                      </p>
                    </div>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <svg
                        className="h-3.5 w-3.5"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M8 5.14v13.72L19 12 8 5.14Z" />
                      </svg>
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    &ldquo;We switched to Vouchreel and demo requests doubled in
                    six weeks.&rdquo;
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 -z-10 h-40 w-40 rounded-full bg-primary/5 blur-2xl" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-b">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Live in three steps
            </h2>
            <p className="mt-3 text-muted-foreground">
              From raw customer video to embedded social proof — without
              touching your codebase.
            </p>
          </div>
          <ol className="mt-14 grid gap-8 md:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-2xl border bg-card p-6 shadow-sm"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-b">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Social proof that does the selling
            </h2>
            <p className="mt-3 text-muted-foreground">
              Everything you need to collect, target, and measure video
              testimonials — nothing you don&apos;t.
            </p>
          </div>
          <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <li
                key={feature.title}
                className="rounded-2xl border bg-card p-6 shadow-sm"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                  >
                    {feature.icon}
                  </svg>
                </span>
                <h3 className="mt-5 text-base font-semibold">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-b bg-muted/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">
              Teams that let their customers do the talking
            </h2>
          </div>
          <ul className="mt-14 grid gap-6 md:grid-cols-3">
            {quotes.map((item) => (
              <li
                key={item.quote}
                className="flex flex-col rounded-2xl border bg-card p-6 shadow-sm"
              >
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                  &ldquo;{item.quote}&rdquo;
                </p>
                <div className="mt-6 flex items-center gap-3 border-t pt-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {item.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.company}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="border-b">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-20 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="mt-3 text-muted-foreground">
              Start free and upgrade when your testimonial wall starts paying
              for itself. Paid plans include a 14-day money-back guarantee.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Free plan for your first spaces and testimonials
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Higher limits, more spaces, and team features as you grow
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Cancel anytime — no long-term contracts
              </li>
            </ul>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              View pricing
            </Link>
            <p className="text-xs text-muted-foreground">
              Pay by card via Stripe, or choose local payment methods via Dodo
              Payments.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Your happiest customers are your best salespeople
          </h2>
          <p className="max-w-2xl text-primary-foreground/80">
            Give them a stage. Collect their story, embed it on your site, and
            watch it work.
          </p>
          <Link
            href="/signup"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-background/90"
          >
            Get started free
          </Link>
        </div>
      </section>
    </>
  );
}
