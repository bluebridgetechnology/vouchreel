import Link from "next/link";
import { ArrowButton } from "@/components/marketing/arrow-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Em } from "@/components/ui/em";
import { Icon } from "@/components/ui/icon";
import { Container } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

/**
 * The closing call to action: a full-width dark band across the page, just above the footer, with a large message and
 * the two things a visitor can do next, start free or try the live demo again. The two soft glows are the brand colour
 * blurred into the background.
 */
export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden bg-surface-inverse text-text-inverse">
      <div aria-hidden="true" className="absolute -left-24 top-0 -z-10 size-96 rounded-pill bg-brand opacity-25 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-24 -right-24 -z-10 size-96 rounded-pill bg-brand opacity-20 blur-3xl" />

      <Container className="flex flex-col items-center gap-8 py-24 text-center sm:py-32">
        <Badge className="bg-text-inverse/10 text-text-inverse">
          <Icon name="play-circle" size="sm" /> Ready when you are
        </Badge>
        <h2 className="max-w-4xl text-4xl font-medium sm:text-6xl">
          Your happiest customers are your best <Em>salespeople</Em>
        </h2>
        <p className="max-w-xl text-lg opacity-80">
          Give them a stage. Collect their story, embed it on your site, and watch it work.
        </p>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <ArrowButton href="/signup" size="xl">
            Start free
          </ArrowButton>
          <Link href="/#demo" className={cn(buttonVariants({ variant: "outline-inverse", size: "xl" }))}>
            <Icon name="play-circle" /> Try the live demo
          </Link>
        </div>
        <p className="text-xs opacity-60">No credit card needed · Free plan, cancel anytime</p>
      </Container>
    </section>
  );
}
