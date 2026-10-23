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
import { CollectMock, ReportMock, TargetMock } from "@/components/marketing/mocks";
import { BrandSlider } from "@/components/marketing/brand-slider";
import { HeroSection } from "@/components/marketing/hero";
import { LayoutPicker } from "@/components/marketing/landing-demo";
import { StackBeam } from "@/components/marketing/stack-beam";
import { getStartingMonthlyPrice } from "@/lib/marketing/plans";

export const metadata: Metadata = {
  title: { absolute: "Vouchreel — Turn customer love into conversions" },
  description:
    "Collect video testimonials with one link, customize a lightweight widget, and embed social proof anywhere. Contextual matching, smart triggers, and conversion tracking built in.",
  alternates: { canonical: "/" },
};

const stats: { value: string; label: string; icon: IconName }[] = [
  { value: "< 10 KB", label: "Embed script, gzipped", icon: "bolt" },
  { value: "No shift", label: "Layout shift on your site", icon: "window-frame" },
  { value: "Minutes", label: "From signup to live", icon: "stopwatch" },
  { value: "Free", label: "Plan to get started", icon: "gift" },
];

const steps = [
  {
    title: "Collect or import",
    description: "Send customers one link to record or upload a video. Or paste a YouTube, Vimeo, or MP4 link you already have.",
    tint: "pink",
  },
  {
    title: "Pick a layout and rules",
    description: "Choose how it looks, when it appears, and which pages show which stories. See it live before you publish.",
    tint: "lime",
  },
  {
    title: "Embed anywhere",
    description: "Drop one async script tag on your site. The widget loads in milliseconds and never blocks your page.",
    tint: "peach",
  },
] as const;

/** What the page has not already shown: the three rows below cover collecting, matching and measuring. */
const more: { title: string; description: string; icon: IconName }[] = [
  {
    title: "Google and Trustpilot reviews",
    description: "Pull in the reviews you already have and show them next to your videos.",
    icon: "star-fall",
  },
  {
    title: "Review videos",
    description: "Turn a written review into a styled video in your brand colours, ready to play or share.",
    icon: "videocamera-record",
  },
  {
    title: "Social clips",
    description: "Export any testimonial as a 9:16 clip for TikTok, Instagram Reels and YouTube Shorts.",
    icon: "share",
  },
  {
    title: "Wall of love page",
    description: "A shareable page of all your testimonials, hosted for you. Link to it from anywhere.",
    icon: "heart",
  },
  {
    title: "Your brand, once",
    description: "Set your colours and fonts a single time and use them across widgets and videos.",
    icon: "palette",
  },
  {
    title: "Consent built in",
    description: "Every testimonial carries a consent record, and the people in them can withdraw it.",
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
    body: "Send customers a single link. They record on their phone or upload a video, and it lands in your inbox ready to approve. No downloads and no back-and-forth.",
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


const agencyPoints: { title: string; description: string; icon: IconName }[] = [
  { title: "Teams with roles", description: "Invite owners, editors and viewers.", icon: "users-group-rounded" },
  { title: "White label", description: "Your branding and your own domain.", icon: "buildings-2" },
  { title: "One view of every client", description: "A cockpit across all the sites you run.", icon: "layers-minimalistic" },
  { title: "Reports clients read", description: "ROI reports as PDF and CSV.", icon: "chart-square" },
];

const faqs = [
  {
    q: "Do my customers need an account to give a testimonial?",
    a: "No. You send a link. They record in their browser or upload a video, and agree to how it will be used as part of the same form. There is nothing to install.",
  },
  {
    q: "Will it slow my site down?",
    a: "The embed is one async script under 10 KB gzipped. The widget holds a fixed position, so it does not shift your layout, and it loads after your page.",
  },
  {
    q: "What can I show in the widget?",
    a: "Videos you collect, YouTube, Vimeo or MP4 links you paste in, text testimonials, and Google or Trustpilot reviews. There are ten ways to lay them out.",
  },
  {
    q: "Does it work with my website builder?",
    a: "It works anywhere you can add a script tag, including Shopify, WordPress, Webflow and Framer. Zapier, Make, an API and webhooks cover the rest.",
  },
  {
    q: "Can I remove the Vouchreel branding?",
    a: "Yes. Paid plans remove the Vouchreel watermark and let you set your own colours. The free plan keeps it.",
  },
  {
    q: "What happens to my customers' data?",
    a: "Each testimonial keeps a record of the consent given, and people can withdraw it. You can delete one person's data, or your whole account, from your settings. Analytics are first-party, with no third-party cookies.",
  },
  {
    q: "Can I try it before paying?",
    a: "Yes. The free plan needs no credit card, so you can collect and embed your first testimonials and decide after.",
  },
];

export default async function LandingPage() {
  const fromPrice = await getStartingMonthlyPrice();
  return (
    <>
      <HeroSection />
      <BrandSlider />

      {/* Layout picker */}
      <Section id="demo" className="scroll-mt-20 pt-8 sm:pt-12">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-medium sm:text-5xl">
              See it on a page, <Em>live</Em>
            </h2>
            <p className="mt-4 text-text-muted">
              Pick a layout and watch the real widget draw it. Switch to a phone to see how it adapts.
            </p>
          </div>
          <div className="mt-10">
            <LayoutPicker />
          </div>
        </Container>
      </Section>

      {/* Stats strip */}
      <Container>
        <Card variant="sunken" className="rounded-panel px-6 py-8 sm:px-10 sm:py-10">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-3 text-center">
                <Icon name={stat.icon} size="xl" className="size-10 text-brand" />
                <div>
                  <dd className="text-xl font-medium tracking-tight sm:text-2xl">{stat.value}</dd>
                  <dt className="mt-1 text-xs text-text-muted sm:text-sm">{stat.label}</dt>
                </div>
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

      {/* Collect, match, measure */}
      <Section id="features" className="pt-0">
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
              </div>
            </div>
          ))}
        </Container>
      </Section>

      {/* Reviews into video */}
      <Section className="pt-0">
        <Container>
          <Card variant="sunken" className="grid items-center gap-10 rounded-panel p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:gap-14">
            <div>
              <Badge variant="eyebrow">Reviews to video</Badge>
              <h2 className="mt-5 text-4xl font-medium sm:text-5xl">
                Already have <Em>reviews</Em>? Make them move
              </h2>
              <p className="mt-5 text-text-muted">
                Import your Google and Trustpilot reviews, pick a style, and Vouchreel turns each one into a short video you
                can play on your site or post on social.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {["Import reviews from Google and Trustpilot", "Five video styles in your brand colours", "Export 9:16 clips for TikTok, Reels and Shorts"].map((b) => (
                  <li key={b} className="flex items-center gap-3">
                    <Icon name="check-circle" size="sm" className="text-success" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                {[1, 2, 4].map((n, i) => (
                  <video
                    key={n}
                    className={cn("aspect-[9/16] w-full rounded-panel bg-surface-sunken object-cover shadow-card", i === 2 && "hidden sm:block")}
                    src={`/demo/sample-${n}.mp4`}
                    poster={`/demo/sample-${n}.jpg`}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                ))}
              </div>
              <p className="mt-3 text-center text-xs text-text-subtle">Sample videos. The people and businesses are made up.</p>
            </div>
          </Card>
        </Container>
      </Section>

      {/* More than a widget */}
      <Section className="pt-0">
        <Container>
          <div className="mb-10 max-w-2xl">
            <h2 className="text-4xl font-medium sm:text-5xl">
              More than a <Em>widget</Em>
            </h2>
            <p className="mt-4 max-w-xl text-text-muted">The rest of what you need to collect, reuse and share customer proof.</p>
          </div>
          <ul className="grid grid-cols-1 border-l border-t sm:grid-cols-2 lg:grid-cols-3">
            {more.map((f, i) => (
              <li
                key={f.title}
                className={cn(
                  "relative flex flex-col gap-3 border-b border-r p-6 transition-colors duration-(--duration-base) md:p-8",
                  i === 0 ? "bg-linear-to-b from-surface to-brand-soft" : "bg-surface hover:bg-linear-to-b hover:from-surface hover:to-brand-soft",
                )}
              >
                {i === 1 && <span aria-hidden="true" className="absolute inset-y-10 left-0 w-1 rounded-r-control bg-brand" />}
                <div className="flex items-center gap-2.5">
                  <Icon name={f.icon} className="text-brand" />
                  <h3 className="text-base font-medium leading-snug">{f.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-text-muted">{f.description}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Fits your stack */}
      <Section className="pt-0">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-medium sm:text-5xl">
              Fits the <Em>stack</Em> you already have
            </h2>
            <p className="mt-4 text-text-muted">
              Paste one script tag anywhere you can edit HTML. Connect Zapier or Make, or build your own with the API and
              webhooks.
            </p>
          </div>
          <StackBeam />
        </Container>
      </Section>

      {/* Agencies */}
      <Section className="pt-0">
        <Container>
          <Card variant="cream" padding="lg" className="grid gap-10 sm:p-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-14">
            <div>
              <Badge variant="eyebrow">For agencies</Badge>
              <h2 className="mt-5 text-4xl font-medium sm:text-5xl">
                Run it for <Em>every client</Em>
              </h2>
              <p className="mt-5 opacity-70">
                One account for all the sites you manage, under your own brand, with the numbers to show clients it works.
              </p>
              <Button asChild variant="ink" className="mt-8">
                <Link href="/pricing">
                  See agency plans <Icon name="arrow-right" size="sm" />
                </Link>
              </Button>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {agencyPoints.map((point) => (
                <li key={point.title} className="flex gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface text-text">
                    <Icon name={point.icon} />
                  </span>
                  <div>
                    <p className="font-medium">{point.title}</p>
                    <p className="mt-0.5 text-sm opacity-70">{point.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </Container>
      </Section>

      {/* Beta */}
      <section className="bg-surface-inverse py-(--space-section) text-text-inverse">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="bg-text-inverse/10 text-text-inverse">
              <Icon name="rocket" size="sm" /> Now in beta
            </Badge>
            <h2 className="mt-8 text-3xl font-medium leading-snug sm:text-5xl">
              Be one of the <Em>first teams</Em> on Vouchreel
            </h2>
            <p className="mx-auto mt-6 max-w-2xl opacity-80">
              We&apos;re working with a small group of beta teams. Their real video testimonials will replace the samples on this
              page, and you can help shape what we build next.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="xl">
                <Link href="/signup">
                  Join the beta <Icon name="arrow-right" size="sm" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline">
                <a href="mailto:support@vouchreel.com?subject=Vouchreel%20beta">Talk to us first</a>
              </Button>
            </div>
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
                Start free and upgrade when your testimonial wall starts paying for itself.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "A free plan to collect and embed your first testimonials",
                  fromPrice ? `Paid plans from $${fromPrice} a month, with more spaces and team features` : "Higher limits, more spaces, and team features as you grow",
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
            </div>
          </Card>
        </Container>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="pt-0">
        <Container>
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <Badge variant="eyebrow">Questions</Badge>
              <h2 className="mt-5 text-4xl font-medium sm:text-5xl">
                Good to <Em>know</Em>
              </h2>
            </div>
            <div className="mt-12 divide-y rounded-panel border bg-surface">
              {faqs.map((item) => (
                <details key={item.q} className="group px-5 py-4 sm:px-7">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <Icon name="alt-arrow-down" size="sm" className="shrink-0 text-text-subtle transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-text-muted">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
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
                Start free <Icon name="arrow-right" size="sm" />
              </Link>
            </Button>
          </Card>
        </Container>
      </Section>
    </>
  );
}
