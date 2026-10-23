import { listPublishedPosts } from "@/lib/blog";
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** GET /blog/feed.xml: the published posts as an RSS feed, newest first, for readers and for search engines. */
export async function GET() {
  const posts = await listPublishedPosts().catch(() => []);
  const items = posts
    .map((post) => {
      const url = absoluteUrl(`/blog/${post.slug}`);
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        post.publishedAt ? `      <pubDate>${post.publishedAt.toUTCString()}</pubDate>` : "",
        post.excerpt ? `      <description>${escapeXml(post.excerpt)}</description>` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(`${SITE_NAME} blog`)}</title>
    <link>${escapeXml(absoluteUrl("/blog"))}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>en</language>
    <atom:link href="${escapeXml(absoluteUrl("/blog/feed.xml"))}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "no-store" } });
}
