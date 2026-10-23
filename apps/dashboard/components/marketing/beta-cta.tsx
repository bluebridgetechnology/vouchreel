import { ArrowButton } from "@/components/marketing/arrow-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Em } from "@/components/ui/em";
import { Icon } from "@/components/ui/icon";
import { Container } from "@/components/ui/layout";

/**
 * The beta call to action: a bordered, rounded panel with a soft glow, a centred message and the sliding-arrow
 * button. There are no customers yet, so it invites the first ones instead of quoting them.
 */
export function BetaCta() {
  return (
    <section>
      <Container className="py-8 sm:py-20">
        <div className="relative isolate flex min-h-96 items-center justify-center overflow-hidden rounded-panel border px-6 py-16">
          {/* The glow: two soft tints blurred into the panel */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-24 -z-10 h-4/5 rounded-pill bg-linear-to-r from-tint-pink from-15% via-canvas via-55% to-tint-peach to-90% opacity-80 blur-3xl"
          />
          <div className="hero-rise mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <Badge variant="eyebrow">
              <Icon name="rocket" size="sm" /> Now in beta
            </Badge>
            <div className="flex flex-col items-center gap-3">
              <h2 className="text-3xl font-medium md:text-5xl">
                Be one of the <Em>first teams</Em> on Vouchreel
              </h2>
              <p className="mx-auto max-w-2xl text-text-muted">
                We&apos;re working with a small group of beta teams. Their real video testimonials will replace the samples on
                this page, and you can help shape what we build next.
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
              <ArrowButton href="/signup" size="lg">
                Join the beta
              </ArrowButton>
              <Button asChild variant="ghost" size="lg" className="text-text">
                <a href="mailto:support@vouchreel.com?subject=Vouchreel%20beta">Talk to us first</a>
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
