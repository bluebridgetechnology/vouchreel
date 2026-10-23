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
import { BetaCta } from "@/components/marketing/beta-cta";
import { BrandSlider } from "@/components/marketing/brand-slider";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { HeroSection } from "@/components/marketing/hero";
import { LayoutPicker } from "@/components/marketing/landing-demo";
import { StackBeam } from "@/components/marketing/stack-beam";
import { getSession } from "@/lib/auth/session";
import { getCurrentPlanId, loadLandingPlans } from "@/lib/marketing/plans";
import { PricingTable } from "./pricing/pricing-table";

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



export default async function LandingPage() {
  const session = await getSession();
  const [plans, currentPlanId] = await Promise.all([
    loadLandingPlans(),
    session?.user ? getCurrentPlanId(session.user.id) : Promise.resolve(null),
  ]);
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

      <BetaCta />

      {/* Pricing */}
      <Section id="pricing">
        <Container>
          <div className="mx-auto mb-12 flex max-w-3xl flex-col items-center gap-4 text-center">
            <Badge variant="eyebrow">Pricing</Badge>
            <h2 className="text-4xl font-medium sm:text-5xl">
              Simple, <Em>transparent</Em> pricing
            </h2>
            <p className="max-w-xl text-text-muted">Start free and upgrade when your testimonial wall starts paying for itself. Cancel anytime.</p>
          </div>
          {plans.length > 0 ? (
            <PricingTable layout="compact" plans={plans} user={session?.user ? { id: session.user.id, email: session.user.email } : null} currentPlanId={currentPlanId} />
          ) : (
            <div className="text-center">
              <Button asChild size="lg">
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          )}
        </Container>
      </Section>

      <Faq />

      <FinalCta />
    </>
  );
}
