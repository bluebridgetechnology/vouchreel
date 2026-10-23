import { BrandMark, brands } from "@/components/marketing/brands";
import { Container } from "@/components/ui/layout";

/** Copies of the row the slider scrolls: enough that the strip never runs out on a wide screen. */
const COPIES = 4;

/** "Works with the tools you already use": the integration logos in a slow, endless strip under the hero. */
export function BrandSlider() {
  return (
    <section aria-label="Works with">
      <Container className="py-6 md:py-10">
        <div className="hero-rise flex flex-col gap-3" style={{ animationDelay: "0.6s" }}>
          <div className="flex items-center justify-center gap-4 py-3">
            <span aria-hidden="true" className="hidden h-px w-40 bg-linear-to-l from-border-strong to-transparent md:block" />
            <p className="px-2 text-center text-sm text-text-muted">Works with the tools you already use</p>
            <span aria-hidden="true" className="hidden h-px w-40 bg-linear-to-r from-border-strong to-transparent md:block" />
          </div>
          <div className="marquee [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
            {Array.from({ length: COPIES }, (_, copy) => (
              <ul key={copy} aria-hidden={copy > 0 ? true : undefined} className="marquee-track">
                {brands.map((brand) => (
                  <li key={brand.name} className="flex items-center gap-2 opacity-70 grayscale transition duration-(--duration-base) hover:opacity-100 hover:grayscale-0">
                    <BrandMark brand={brand} className="h-6" />
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
