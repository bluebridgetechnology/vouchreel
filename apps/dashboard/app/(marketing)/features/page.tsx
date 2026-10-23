import type { Metadata } from "next";
import Link from "next/link";
import { ArrowButton } from "@/components/marketing/arrow-button";
import { FinalCta } from "@/components/marketing/final-cta";
import { LayoutPreview } from "@/components/marketing/layout-preview";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Em } from "@/components/ui/em";
import { Icon } from "@/components/ui/icon";
import { Container, Section } from "@/components/ui/layout";
import type { IconName } from "@/lib/icons.generated";
import type { WidgetTemplate } from "@/lib/validations/widget-config";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = pageMetadata({
  title: "Features and widget layouts",
  description:
    "Every Vouchreel widget layout, live: floating bubbles and reels, carousels, walls of love and more, with rules for when and where each one appears.",
  path: "/features",
});

interface LayoutEntry {
  id: WidgetTemplate;
  name: string;
  blurb: string;
  points: string[];
}

/** The layouts, grouped by where they sit. The wording follows what each one does in the widget. */
const GROUPS: { id: string; title: React.ReactNode; intro: string; layouts: LayoutEntry[] }[] = [
  {
    id: "floating",
    title: (
      <>
        Floats on <Em>every page</Em>
      </>
    ),
    intro: "These sit in a corner of each page you choose, so proof follows visitors wherever they go.",
    layouts: [
      {
        id: "floating-bubble",
        name: "Video bubble",
        blurb: "A round video playing in the corner of the page. Visitors tap it to open the full testimonial.",
        points: ["Plays on its own, muted", "Works on any page", "Circle, soft-cornered or tall shapes"],
      },
      {
        id: "floating-card",
        name: "Floating card",
        blurb: "A small card in the corner with a testimonial on it. The quietest way to add proof to a page.",
        points: ["Name, company and quote", "Opens the player on click", "Six picture shapes"],
      },
      {
        id: "floating-reel",
        name: "Video reel",
        blurb: "A tall card you swipe through, in the style of social stories. Made for phones and social-style sites.",
        points: ["Swipe through videos", "Tall, portrait or square", "Feels native on mobile"],
      },
      {
        id: "story-strip",
        name: "Story strip",
        blurb: "A row of tappable bubbles for mobile visitors, each opening a testimonial.",
        points: ["One tap to watch", "Built for phones", "Circle, soft-cornered or tall"],
      },
    ],
  },
  {
    id: "inline",
    title: (
      <>
        Sits <Em>in your page</Em>
      </>
    ),
    intro: "These go where you place them: a section of a landing page, a pricing page or a page of their own.",
    layouts: [
      {
        id: "carousel",
        name: "Carousel",
        blurb: "A swipeable row of testimonial cards that can move along on its own.",
        points: ["Swipe or use the arrows", "Optional auto-advance", "Good for landing pages"],
      },
      {
        id: "wall-of-love",
        name: "Wall of love",
        blurb: "An even grid of your testimonials. Give it a page of its own, or a section at the end of a long one.",
        points: ["One to four columns", "Even, tidy grid", "Videos and text together"],
      },
      {
        id: "masonry",
        name: "Masonry",
        blurb: "Staggered columns that mix short quotes with videos, so a mixed set of testimonials looks natural.",
        points: ["Quotes and videos mixed", "Staggered columns", "Adjustable gaps"],
      },
      {
        id: "reel-feed",
        name: "Reel feed",
        blurb: "Tall tiles that open full screen, for product and landing pages.",
        points: ["Opens full screen", "Tall, portrait or square tiles", "Feels like a feed"],
      },
      {
        id: "spotlight",
        name: "Spotlight",
        blurb: "One big testimonial at a time. The right fit for a hero or pricing section, where one story should land.",
        points: ["One story, large", "Optional auto-advance", "Landscape or portrait"],
      },
      {
        id: "marquee",
        name: "Marquee",
        blurb: "A slow strip of reviews and videos that keeps moving across the page.",
        points: ["Videos and reviews", "Always in motion", "Pauses when hovered"],
      },
    ],
  },
];

const TRIGGERS: { title: string; description: string; icon: IconName }[] = [
  { title: "After a delay", description: "Show the widget once a visitor has spent a set number of seconds on the page.", icon: "clock-circle" },
  { title: "On scroll", description: "Show it once they scroll past a percentage of the page.", icon: "alt-arrow-down" },
  { title: "On exit intent", description: "Catch them as the cursor heads for the way out, before they leave.", icon: "logout" },
  { title: "After some pages", description: "Show it once a visitor has browsed a number of pages in their session.", icon: "eye" },
  { title: "For returning visitors", description: "Only for people who have been to your site before: proof for repeat shoppers.", icon: "restart" },
];

const CUSTOMIZE: { title: string; description: string; icon: IconName }[] = [
  { title: "Colours and corners", description: "Your brand colours, light or dark, background and text colours, and how round the corners are.", icon: "palette" },
  { title: "Shapes and sizes", description: "Circle, square, soft-cornered, landscape, portrait or tall pictures, in small, medium or large.", icon: "layers-minimalistic" },
  { title: "What shows", description: "Choose whether each card shows the name, company, stars, source and quote.", icon: "eye" },
  { title: "Depth and motion", description: "Soft or strong shadows, borders, frosted glass, and a fade, slide or pop entrance. Off for anyone who asks for less motion.", icon: "magic-stick-3" },
  { title: "Your fonts", description: "Inherit the font from your site, or name one your site already loads.", icon: "settings" },
  { title: "Brand kit", description: "Set your colours and fonts once and use them across every widget and video.", icon: "tag" },
];

const MEASURE: { title: string; description: string; icon: IconName }[] = [
  { title: "Plays, clicks and goals", description: "See which testimonials are watched, which are clicked and which lead to a goal.", icon: "chart-square" },
  { title: "A/B experiments", description: "Test a layout, a position or a trigger against another and roll out the winner.", icon: "bolt" },
  { title: "Page targeting", description: "Include or exclude any path, and match stories to pages by path, tag or campaign.", icon: "global" },
];

/** The ruled grid used for lists of small features. */
function RuledGrid({ items, columns }: { items: { title: string; description: string; icon: IconName }[]; columns: string }) {
  return (
    <ul className={cn("grid grid-cols-1 border-l border-t sm:grid-cols-2", columns)}>
      {items.map((item) => (
        <li key={item.title} className="flex flex-col gap-3 border-b border-r bg-surface p-6 transition-colors hover:bg-surface-sunken md:p-8">
          <div className="flex items-center gap-2.5">
            <Icon name={item.icon} className="text-brand" />
            <h3 className="text-base font-medium leading-snug">{item.title}</h3>
          </div>
          <p className="text-sm leading-relaxed text-text-muted">{item.description}</p>
        </li>
      ))}
    </ul>
  );
}

export default function FeaturesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema([{ name: "Features", path: "/features" }])} />
      {/* Intro */}
      <Section className="pb-8 pt-16 sm:pt-24">
        <Container>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <Badge variant="eyebrow">Features</Badge>
            <h1 className="text-5xl font-medium sm:text-display">
              Every way to show <Em>customer proof</Em>
            </h1>
            <p className="max-w-2xl text-lg text-text-muted">
              Eleven widget layouts that fit any site, with rules for when and where each one appears. Everything below is the real widget,
              playing the same sample videos.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
              <ArrowButton href="/signup" size="lg">
                Start free
              </ArrowButton>
              <Link href="#floating" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "text-text")}>
                <Icon name="arrow-right" className="rotate-90" /> See the layouts
              </Link>
            </div>
            <p className="text-xs text-text-subtle">The people and businesses in the previews are made up.</p>
          </div>
        </Container>
      </Section>

      {/* The layouts */}
      {GROUPS.map((group) => (
        <Section key={group.id} id={group.id} className="scroll-mt-24">
          <Container className="space-y-16 sm:space-y-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-4xl font-medium sm:text-5xl">{group.title}</h2>
              <p className="mt-4 text-text-muted">{group.intro}</p>
            </div>
            {group.layouts.map((layout, i) => (
              <div key={layout.id} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div className={cn("min-w-0", i % 2 === 1 && "lg:order-2")}>
                  <LayoutPreview template={layout.id} />
                </div>
                <div className={cn("min-w-0", i % 2 === 1 && "lg:order-1")}>
                  <Badge variant="outline">{group.id === "floating" ? "Floats on your page" : "Sits in your page"}</Badge>
                  <h3 className="mt-5 text-3xl font-medium sm:text-4xl">{layout.name}</h3>
                  <p className="mt-4 text-text-muted">{layout.blurb}</p>
                  <ul className="mt-6 space-y-3 text-sm">
                    {layout.points.map((point) => (
                      <li key={point} className="flex items-center gap-3">
                        <Icon name="check-circle" size="sm" className="text-brand" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </Container>
        </Section>
      ))}

      {/* The rating badge has no video to preview */}
      <Section className="pt-0">
        <Container>
          <Card variant="sunken" className="grid items-center gap-8 rounded-panel p-8 sm:p-10 lg:grid-cols-[1fr_1.2fr]">
            <div className="flex flex-col items-start gap-4">
              <span className="inline-flex items-center gap-2 rounded-pill border bg-surface px-4 py-2 text-sm shadow-card">
                <span className="flex text-brand">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Icon key={i} name="star" size="sm" />
                  ))}
                </span>
                Rated by your customers
              </span>
              <p className="text-sm text-text-subtle">An illustration: the badge shows your own score.</p>
            </div>
            <div>
              <h3 className="text-3xl font-medium sm:text-4xl">Rating badge</h3>
              <p className="mt-4 text-text-muted">
                A small score for headers and footers that opens your reviews when clicked. It uses the Google and Trustpilot reviews you
                have imported, so there is nothing to preview until your reviews are in.
              </p>
            </div>
          </Card>
        </Container>
      </Section>

      {/* When */}
      <Section className="pt-0">
        <Container>
          <div className="mb-10 max-w-2xl">
            <h2 className="text-4xl font-medium sm:text-5xl">
              Choose <Em>when</Em> it appears
            </h2>
            <p className="mt-4 text-text-muted">Floating widgets wait for the right moment. Pick one trigger per widget, or run experiments to compare them.</p>
          </div>
          <RuledGrid items={TRIGGERS} columns="lg:grid-cols-3" />
        </Container>
      </Section>

      {/* Make it yours */}
      <Section className="pt-0">
        <Container>
          <div className="mb-10 max-w-2xl">
            <h2 className="text-4xl font-medium sm:text-5xl">
              Make it <Em>yours</Em>
            </h2>
            <p className="mt-4 text-text-muted">A live preview in the editor shows every change on a sample page, at desktop, tablet or phone size, before you publish.</p>
          </div>
          <RuledGrid items={CUSTOMIZE} columns="lg:grid-cols-3" />
        </Container>
      </Section>

      {/* Measure and target */}
      <Section className="pt-0">
        <Container>
          <div className="mb-10 max-w-2xl">
            <h2 className="text-4xl font-medium sm:text-5xl">
              Show the right story, then <Em>measure</Em> it
            </h2>
            <p className="mt-4 text-text-muted">Put the pricing-page story on the pricing page, and see which testimonials earn their place.</p>
          </div>
          <RuledGrid items={MEASURE} columns="lg:grid-cols-3" />
        </Container>
      </Section>

      <FinalCta />
    </>
  );
}
