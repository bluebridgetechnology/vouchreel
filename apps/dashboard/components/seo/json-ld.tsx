import { jsonLdString } from "@/lib/seo";

/**
 * Structured data for search engines, as a JSON-LD block. Pass one schema, or a list to put several in the same block.
 * The block is data, so the page's script policy does not block it and it does not run.
 */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
