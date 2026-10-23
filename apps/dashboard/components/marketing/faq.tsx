import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Em } from "@/components/ui/em";
import { Icon } from "@/components/ui/icon";
import { Container } from "@/components/ui/layout";

export interface FaqItem {
  q: string;
  a: string;
}

/** The homepage's questions. Each answer says only what the product does today. */
export const HOME_FAQS: FaqItem[] = [
  {
    q: "Do my customers need an account to give a testimonial?",
    a: "No. You send them a link. They record in their browser or upload a video, and agree to how it will be used as part of the same form. There is nothing for them to install.",
  },
  {
    q: "Do I need a developer to add the widget to my site?",
    a: "No. You paste one script tag where your site lets you add code, such as a site-wide footer or header setting. Shopify, WordPress, Webflow and Framer all have a place for it.",
  },
  {
    q: "Will it slow my site down?",
    a: "No. The embed is one async script under 10 KB gzipped, so it loads after your page. The widget holds a fixed position, so it does not shift your layout while it appears.",
  },
  {
    q: "What can I show in the widget?",
    a: "Videos you collect, YouTube, Vimeo or MP4 links you paste in, written testimonials, and Google or Trustpilot reviews. You choose the layout, from a floating video bubble to a full wall of love.",
  },
  {
    q: "Does it work with my website builder?",
    a: "Yes, anywhere you can add a script tag, including Shopify, WordPress, Webflow and Framer. Zapier, Make, an API and webhooks cover everything else.",
  },
  {
    q: "Can I remove the Vouchreel branding?",
    a: "Yes. Paid plans remove the Vouchreel watermark and let you set your own colours. The free plan keeps it.",
  },
  {
    q: "What happens to my customers' data?",
    a: "Each testimonial keeps a record of the consent given, and people can withdraw it. You can delete one person's data, or your whole account, from your settings. Analytics are first-party, with no third-party cookies. The privacy policy has the details.",
  },
  {
    q: "Can I try it before paying?",
    a: "Yes. The free plan needs no credit card, so you can collect and embed your first testimonials and decide after.",
  },
];

interface FaqProps {
  items?: FaqItem[];
  /** The anchor other pages link to, such as /#faq. */
  id?: string;
  eyebrow?: string;
  title?: React.ReactNode;
  intro?: string;
}

/**
 * Frequently asked questions: the heading and a way to ask on the left, the questions on the right as an accordion
 * where opening one closes the others (the shared `name` on the details elements does that, with no script).
 */
export function Faq({
  items = HOME_FAQS,
  id = "faq",
  eyebrow = "FAQ",
  title = (
    <>
      Frequently asked <Em>questions</Em>
    </>
  ),
  intro = "The answers to what people ask before they start. Can't find yours? Write to us and a person will reply.",
}: FaqProps) {
  return (
    <section id={id} className="scroll-mt-24">
      <Container className="py-8 sm:py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Badge variant="eyebrow">{eyebrow}</Badge>
            <h2 className="mt-5 text-4xl font-medium sm:text-5xl">{title}</h2>
            <p className="mt-4 max-w-sm text-text-muted">{intro}</p>
            <Button asChild variant="outline" className="mt-6">
              <a href="mailto:support@vouchreel.com?subject=Vouchreel%20question">
                <Icon name="chat-round-like" size="sm" /> Ask a question
              </a>
            </Button>
          </div>

          <div className="divide-y rounded-panel border bg-surface">
            {items.map((item) => (
              <details key={item.q} name={id} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-panel px-5 py-5 text-base font-medium transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:px-7 [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <Icon name="alt-arrow-down" size="sm" className="shrink-0 text-text-subtle transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="max-w-prose px-5 pb-6 pr-12 text-sm leading-relaxed text-text-muted sm:px-7 sm:pr-14">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
