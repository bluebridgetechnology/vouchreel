import type { Metadata } from "next";
import type { PlanItem } from "@/app/(marketing)/pricing/pricing-table";
import type { BlogListItem, BlogPost } from "@/lib/blog";

/** The site's public address, with no trailing slash. Set NEXT_PUBLIC_APP_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
export const SITE_NAME = "Vouchreel";
export const SITE_TAGLINE = "Turn customer love into conversions";
export const SITE_DESCRIPTION =
  "Collect video testimonials with one link, then show the right story on the right page with a lightweight widget and built-in conversion tracking.";
export const SUPPORT_EMAIL = "support@vouchreel.com";

/** True while the site is running somewhere that is not a real public address (a laptop, a preview). Such a site asks not to be indexed. */
export const isLocalSite = /localhost|127\.0\.0\.1|\.local\b/i.test(SITE_URL);

/** Areas that belong to signed-in users or to a customer's own pages, not to the marketing site. */
export const PRIVATE_PATHS = [
  "/api/",
  "/dashboard",
  "/admin",
  "/settings",
  "/spaces",
  "/agency",
  "/account",
  "/notifications",
  "/onboarding",
  "/collect/",
  "/widget/",
  "/consent/",
  "/checkout/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/two-factor",
  "/design",
];

/** A full address for a path on this site; an address that is already full is left as it is. */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), "g");
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), "g");

/**
 * JSON for a `<script type="application/ld+json">` block. It is data, not script, but it sits inside HTML, so `<` is
 * escaped (a post title containing "</script>" cannot end the block early), and so are the two line separators that
 * older parsers treat as line breaks.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(LINE_SEPARATOR, "\\u2028").replace(PARAGRAPH_SEPARATOR, "\\u2029");
}

const LOGO_URL = absoluteUrl("/brand/logo.png");

/** The picture shown when a marketing page is shared: the same one as the homepage's (public/brand/og.png, 1200 x 630). A blog post with a cover image uses that instead. */
export const SOCIAL_IMAGE = { url: absoluteUrl("/brand/og.png"), width: 1200, height: 630, alt: `${SITE_NAME}: ${SITE_TAGLINE}` };

const organizationRef = { "@id": absoluteUrl("/#organization") };

/** Who runs the site. Used on the homepage and referenced by the other schemas. */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: SITE_NAME,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: LOGO_URL },
    description: SITE_DESCRIPTION,
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: SUPPORT_EMAIL },
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: organizationRef,
  };
}

/** The trail from the homepage to a page: [{ name: "Blog", path: "/blog" }, ...]. */
export function breadcrumbSchema(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "Home", path: "/" }, ...trail].map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqSchema(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/**
 * The product and what it costs, from the active plans (so a price changed in the admin area changes this too). It states
 * no rating or review count: there are no customers' reviews to count yet.
 */
export function softwareApplicationSchema(plans: PlanItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": absoluteUrl("/#software"),
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    publisher: organizationRef,
    ...(plans.length > 0 && {
      offers: plans.map((plan) => ({
        "@type": "Offer",
        name: plan.price === 0 ? plan.name : `${plan.name} (${plan.interval === "year" ? "yearly" : "monthly"})`,
        price: (plan.price / 100).toFixed(2),
        priceCurrency: "USD",
        url: absoluteUrl("/pricing"),
        ...(plan.description && { description: plan.description }),
      })),
    }),
  };
}

/** The blog as a whole, with its published posts. */
export function blogSchema(posts: BlogListItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": absoluteUrl("/blog#blog"),
    name: `${SITE_NAME} blog`,
    url: absoluteUrl("/blog"),
    publisher: organizationRef,
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.title,
      url: absoluteUrl(`/blog/${post.slug}`),
      ...(post.publishedAt && { datePublished: post.publishedAt.toISOString() }),
    })),
  };
}

/** One post as an article: headline, dates, author and picture, so search results can show them. */
export function blogPostingSchema(post: BlogPost) {
  const url = absoluteUrl(`/blog/${post.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#post`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: post.title,
    ...(post.excerpt && { description: post.excerpt }),
    ...(post.coverImageUrl && { image: [absoluteUrl(post.coverImageUrl)] }),
    ...(post.publishedAt && { datePublished: post.publishedAt.toISOString() }),
    dateModified: post.updatedAt.toISOString(),
    author: post.authorName ? { "@type": "Person", name: post.authorName } : organizationRef,
    publisher: organizationRef,
  };
}

/**
 * Metadata for a marketing page: its title and description, the canonical address, and the Open Graph and Twitter cards
 * (a page that sets its own `openGraph` replaces the site-wide one, so it has to carry the title and address itself).
 */
export function pageMetadata({ title, description, path, type = "website" }: { title: string; description: string; path: string; type?: "website" | "article" }): Metadata {
  const fullTitle = `${title} · ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type, siteName: SITE_NAME, title: fullTitle, description, url: absoluteUrl(path), locale: "en_US", images: [SOCIAL_IMAGE] },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [SOCIAL_IMAGE.url] },
  };
}
