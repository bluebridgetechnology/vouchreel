import Link from "next/link";
import { ArrowButton } from "@/components/marketing/arrow-button";
import { buttonVariants } from "@/components/ui/button";
import { Em } from "@/components/ui/em";
import { Icon } from "@/components/ui/icon";
import { Container } from "@/components/ui/layout";
import { cn } from "@/lib/utils";

/**
 * The landing page's hero: a soft glow behind a large centred headline, the subheadline, a call to action whose
 * arrow slides across on hover, and a quiet link to the live demo. Each part rises into place in turn
 * (`hero-rise`, in globals.css, which reduced motion turns off).
 */
export function HeroSection() {
  return (
    <section className="relative isolate">
      {/* The glow: two soft tints blurred into the page behind the headline */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-24 -z-10 mx-auto h-full max-h-[32rem] max-w-6xl rounded-pill bg-linear-to-r from-tint-pink via-canvas to-tint-peach opacity-80 blur-3xl"
      />
      <Container className="pb-6 pt-12 md:pb-10 md:pt-20">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-4 sm:gap-6">
            <h1 className="hero-rise text-display font-medium">
              Video testimonials that show up where buyers <Em>decide</Em>
            </h1>
            <p className="hero-rise max-w-2xl text-base text-text-muted sm:text-lg" style={{ animationDelay: "0.1s" }}>
              Collect customer videos with one link. Vouchreel shows the right story on the right page, from pricing to
              product, with one script tag that never slows your site down.
            </p>
          </div>

          <div className="hero-rise flex flex-col items-center gap-5 sm:flex-row sm:gap-8" style={{ animationDelay: "0.2s" }}>
            <ArrowButton href="/signup" size="xl">
              Start free
            </ArrowButton>
            <Link href="/#demo" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "text-text")}>
              <Icon name="play-circle" /> Try the live demo
            </Link>
          </div>

          <p className="hero-rise text-xs text-text-subtle" style={{ animationDelay: "0.3s" }}>
            No credit card needed · Free plan, cancel anytime
          </p>
        </div>
      </Container>
    </section>
  );
}
