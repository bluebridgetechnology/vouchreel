import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/layout";

export interface LegalSection {
  title: string;
  /** Paragraphs, then an optional list. */
  body: string[];
  list?: string[];
}

/** A plain reading page for the privacy policy and terms: a title, when it was last changed, and numbered sections. */
export function LegalPage({ title, intro, updated, sections }: { title: string; intro: string; updated: string; sections: LegalSection[] }) {
  return (
    <Container className="py-16 sm:py-24">
      <article className="mx-auto max-w-3xl">
        <Badge variant="eyebrow">Legal</Badge>
        <h1 className="mt-5 text-4xl font-medium sm:text-5xl">{title}</h1>
        <p className="mt-3 text-sm text-text-subtle">Last updated {updated}</p>
        <p className="mt-8 text-lg text-text-muted">{intro}</p>
        <div className="mt-12 space-y-10">
          {sections.map((section, i) => (
            <section key={section.title} aria-labelledby={`legal-${i}`}>
              <h2 id={`legal-${i}`} className="text-2xl font-medium">
                {i + 1}. {section.title}
              </h2>
              <div className="mt-3 space-y-3 leading-relaxed text-text-muted">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.list && (
                  <ul className="list-disc space-y-1.5 pl-5">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      </article>
    </Container>
  );
}
