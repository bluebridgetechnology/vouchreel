import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

/** The SEO module reads the site address when it loads, so each test loads it fresh with the address it wants. */
async function loadSeo(siteUrl = "https://vouchreel.example") {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", siteUrl);
  return import("../seo");
}

beforeEach(() => vi.unstubAllEnvs());
afterEach(() => vi.unstubAllEnvs());

describe("absoluteUrl", () => {
  it("joins a path to the site address, with or without the leading slash", async () => {
    const { absoluteUrl } = await loadSeo("https://vouchreel.example/");
    expect(absoluteUrl("/pricing")).toBe("https://vouchreel.example/pricing");
    expect(absoluteUrl("pricing")).toBe("https://vouchreel.example/pricing");
    expect(absoluteUrl()).toBe("https://vouchreel.example/");
  });

  it("leaves a full address alone", async () => {
    const { absoluteUrl } = await loadSeo();
    expect(absoluteUrl("https://cdn.example/cover.jpg")).toBe("https://cdn.example/cover.jpg");
  });
});

describe("jsonLdString", () => {
  it("cannot be closed early by text that contains a closing script tag", async () => {
    const { jsonLdString } = await loadSeo();
    const out = jsonLdString({ headline: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).headline).toBe("</script><script>alert(1)</script>");
  });

  it("escapes the line and paragraph separators and still round-trips", async () => {
    const { jsonLdString } = await loadSeo();
    const text = `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`;
    const out = jsonLdString({ text });
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(out).text).toBe(text);
  });
});

describe("schemas", () => {
  it("numbers a breadcrumb trail from the homepage", async () => {
    const { breadcrumbSchema } = await loadSeo();
    const trail = breadcrumbSchema([{ name: "Blog", path: "/blog" }, { name: "A post", path: "/blog/a-post" }]);
    expect(trail.itemListElement.map((i) => [i.position, i.name, i.item])).toEqual([
      [1, "Home", "https://vouchreel.example/"],
      [2, "Blog", "https://vouchreel.example/blog"],
      [3, "A post", "https://vouchreel.example/blog/a-post"],
    ]);
  });

  it("turns questions into a FAQ page", async () => {
    const { faqSchema } = await loadSeo();
    const faq = faqSchema([{ q: "Is it free?", a: "There is a free plan." }]);
    expect(faq["@type"]).toBe("FAQPage");
    expect(faq.mainEntity[0]).toEqual({ "@type": "Question", name: "Is it free?", acceptedAnswer: { "@type": "Answer", text: "There is a free plan." } });
  });

  it("prices the software from the plans, in dollars, and invents no rating", async () => {
    const { softwareApplicationSchema } = await loadSeo();
    const plan = (over: Record<string, unknown>) => ({ id: "x", name: "Pro", price: 1900, interval: "month" as const, features: [], isActive: true, ...over });
    const schema = softwareApplicationSchema([plan({}), plan({ price: 19000, interval: "year" }), plan({ name: "Free", price: 0, description: "Try it" })]);
    expect(schema.offers?.map((o) => [o.name, o.price, o.priceCurrency])).toEqual([
      ["Pro (monthly)", "19.00", "USD"],
      ["Pro (yearly)", "190.00", "USD"],
      ["Free", "0.00", "USD"],
    ]);
    expect(JSON.stringify(schema)).not.toMatch(/aggregateRating|reviewCount|ratingValue/);
  });

  it("leaves offers out when there are no plans, instead of listing none", async () => {
    const { softwareApplicationSchema } = await loadSeo();
    expect("offers" in softwareApplicationSchema([])).toBe(false);
  });

  it("describes a post with its dates, picture and author", async () => {
    const { blogPostingSchema } = await loadSeo();
    const post = {
      id: "1",
      slug: "a-post",
      title: "A post",
      excerpt: "Summary",
      content: "x",
      coverImageUrl: "/demo/cover.jpg",
      authorName: "Ada",
      isPublished: true,
      publishedAt: new Date("2026-10-01T09:00:00.000Z"),
      createdAt: new Date("2026-09-30T09:00:00.000Z"),
      updatedAt: new Date("2026-10-02T09:00:00.000Z"),
    };
    const schema = blogPostingSchema(post);
    expect(schema.headline).toBe("A post");
    expect(schema.image).toEqual(["https://vouchreel.example/demo/cover.jpg"]);
    expect(schema.datePublished).toBe("2026-10-01T09:00:00.000Z");
    expect(schema.dateModified).toBe("2026-10-02T09:00:00.000Z");
    expect(schema.author).toEqual({ "@type": "Person", name: "Ada" });
    expect(blogPostingSchema({ ...post, authorName: null }).author).toEqual({ "@id": "https://vouchreel.example/#organization" });
  });
});

describe("pageMetadata", () => {
  it("carries the canonical address and share cards, with the social picture", async () => {
    const { pageMetadata } = await loadSeo();
    const meta = pageMetadata({ title: "Pricing", description: "Plans", path: "/pricing" });
    expect(meta.alternates?.canonical).toBe("/pricing");
    expect(meta.openGraph).toMatchObject({ title: "Pricing · Vouchreel", url: "https://vouchreel.example/pricing", images: [{ url: "https://vouchreel.example/brand/og.png" }] });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", images: ["https://vouchreel.example/brand/og.png"] });
  });
});

describe("robots", () => {
  it("asks to be left out of search results on a local or preview address", async () => {
    await loadSeo("http://localhost:3000");
    const { default: robots } = await import("@/app/robots");
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("on the real address allows the site, keeps private areas out and points at the sitemap", async () => {
    await loadSeo("https://vouchreel.example");
    const { default: robots } = await import("@/app/robots");
    const result = robots();
    const rules = result.rules as { allow: string; disallow: string[] };
    expect(rules.allow).toBe("/");
    for (const path of ["/api/", "/dashboard", "/admin", "/collect/", "/login", "/signup"]) expect(rules.disallow).toContain(path);
    expect(rules.disallow).not.toContain("/blog");
    expect(result.sitemap).toBe("https://vouchreel.example/sitemap.xml");
  });
});

describe("sitemap", () => {
  it("lists the public pages and the published posts, and not sign-in or the dashboard", async () => {
    await loadSeo("https://vouchreel.example");
    vi.doMock("@/lib/blog", () => ({
      listPublishedPosts: async () => [{ slug: "first", publishedAt: new Date("2026-10-01"), updatedAt: new Date("2026-10-03") }],
    }));
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toEqual(
      expect.arrayContaining(["https://vouchreel.example/", "https://vouchreel.example/features", "https://vouchreel.example/pricing", "https://vouchreel.example/blog", "https://vouchreel.example/blog/first"]),
    );
    expect(urls.some((u) => /login|signup|dashboard|admin|collect/.test(u))).toBe(false);
  });

  it("still answers, with just the pages, when the posts cannot be read", async () => {
    await loadSeo("https://vouchreel.example");
    vi.doMock("@/lib/blog", () => ({
      listPublishedPosts: async () => {
        throw new Error("db down");
      },
    }));
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain("https://vouchreel.example/pricing");
    expect(urls.some((u) => u.includes("/blog/"))).toBe(false);
  });
});
