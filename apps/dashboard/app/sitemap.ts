import type { MetadataRoute } from "next";
import { listPublishedPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";
import { log } from "@/lib/log";

/** The public pages worth indexing. Sign-in, the dashboard and customers' own pages are left out (see robots.ts). */
const PAGES: { path: string; changeFrequency: "daily" | "weekly" | "monthly" | "yearly"; priority: number }[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/features", changeFrequency: "monthly", priority: 0.9 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
];

// Built on each request, so a newly published blog post is listed as soon as it goes live
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPublishedPosts().catch((err) => {
    log.warn("Sitemap: could not read the blog posts:", err);
    return [];
  });
  const latestPost = posts.reduce<Date | null>((latest, p) => (p.publishedAt && (!latest || p.publishedAt > latest) ? p.publishedAt : latest), null);

  return [
    ...PAGES.map((page) => ({
      url: absoluteUrl(page.path),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      // The blog list changes when a post is published; the other pages carry no date rather than a made-up one
      ...(page.path === "/blog" && latestPost && { lastModified: latestPost }),
    })),
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
