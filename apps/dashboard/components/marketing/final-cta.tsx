import Link from "next/link";
import { ArrowButton } from "@/components/marketing/arrow-button";
import { buttonVariants } from "@/components/ui/button";
import { Em } from "@/components/ui/em";
import { Icon } from "@/components/ui/icon";
import { Container } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

/**
 * The closing call to action: a full-width dark band across the page, just above the footer. Kept short on purpose, a
 * nudge at the end of the page and not another section: on a wide screen the message is on the left and the two things a
 * visitor can do next, start free or try the live demo again, are on the right; on a phone they stack. The two soft
 * glows are the brand colour blurred into the background.
 */
export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden bg-surface-inverse text-text-inverse">
      <div aria-hidden="true" className="absolute -left-24 top-0 -z-10 size-72 rounded-pill bg-brand opacity-25 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-24 -right-24 -z-10 size-72 rounded-pill bg-brand opacity-20 blur-3xl" />

      <Container className="flex flex-col items-center gap-6 py-10 text-center lg:flex-row lg:justify-between lg:gap-12 lg:py-12 lg:text-left">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-3xl font-medium sm:text-4xl">
            Your happiest customers are
            <br />
            your best <Em>salespeople</Em>
          </h2>
          <p className="opacity-80">Give them a stage. Collect their story, embed it on your site, and watch it work.</p>
        </div>
        <div className="flex flex-col items-center gap-3 lg:items-end">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <ArrowButton href="/signup" size="lg">
              Start free
            </ArrowButton>
            <Link href="/#demo" className={cn(buttonVariants({ variant: "outline-inverse", size: "lg" }))}>
              <Icon name="play-circle" /> Try the live demo
            </Link>
          </div>
          <p className="text-xs opacity-60">No credit card needed · Free plan, cancel anytime</p>
        </div>
      </Container>
    </section>
  );
}
