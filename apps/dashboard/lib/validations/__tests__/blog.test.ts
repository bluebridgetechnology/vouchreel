import { describe, expect, it } from "vitest";
import { blogPostSchema, slugify } from "../blog";

const valid = {
  title: "How to ask for a video testimonial",
  slug: "how-to-ask-for-a-video-testimonial",
  excerpt: "A short guide",
  content: "# Hello\n\nSome words.",
  coverImageUrl: "https://example.com/cover.jpg",
  authorName: "Ada",
  isPublished: false,
  publishedAt: null,
};

describe("slugify", () => {
  it("makes a web address from a title", () => {
    expect(slugify("How to ask for a Video Testimonial!")).toBe("how-to-ask-for-a-video-testimonial");
  });

  it("drops accents and symbols and collapses the gaps", () => {
    expect(slugify("  Café — 5 tips & tricks  ")).toBe("cafe-5-tips-tricks");
  });

  it("keeps it short and never ends on a hyphen", () => {
    const slug = slugify("word ".repeat(40));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("is empty when there is nothing usable", () => {
    expect(slugify("***")).toBe("");
  });
});

describe("blogPostSchema", () => {
  it("accepts a draft and turns blanks into null", () => {
    const parsed = blogPostSchema.parse({ ...valid, excerpt: "  ", coverImageUrl: "", authorName: "" });
    expect(parsed.excerpt).toBeNull();
    expect(parsed.coverImageUrl).toBeNull();
    expect(parsed.authorName).toBeNull();
  });

  it("turns the publish date into a Date, and blank into null", () => {
    expect(blogPostSchema.parse({ ...valid, publishedAt: "2026-11-01T09:30:00.000Z" }).publishedAt).toEqual(new Date("2026-11-01T09:30:00.000Z"));
    expect(blogPostSchema.parse({ ...valid, publishedAt: "" }).publishedAt).toBeNull();
  });

  it("refuses a date that is not a date", () => {
    expect(blogPostSchema.safeParse({ ...valid, publishedAt: "not a date" }).success).toBe(false);
  });

  it("refuses web addresses that are not lower-case words and hyphens", () => {
    for (const slug of ["Has Capitals", "has space", "-leading", "trailing-", "double--hyphen", "../escape", "a/b"]) {
      expect(blogPostSchema.safeParse({ ...valid, slug }).success, slug).toBe(false);
    }
  });

  it("refuses to publish an empty post", () => {
    const result = blogPostSchema.safeParse({ ...valid, isPublished: true, content: "   " });
    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((i) => i.path[0])).toContain("content");
    expect(blogPostSchema.safeParse({ ...valid, isPublished: false, content: "" }).success).toBe(true);
  });

  it("refuses a cover image address that is not a path or an http(s) address", () => {
    expect(blogPostSchema.safeParse({ ...valid, coverImageUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(blogPostSchema.safeParse({ ...valid, coverImageUrl: "/demo/cover.jpg" }).success).toBe(true);
  });

  it("limits the title and the summary", () => {
    expect(blogPostSchema.safeParse({ ...valid, title: "ab" }).success).toBe(false);
    expect(blogPostSchema.safeParse({ ...valid, title: "x".repeat(121) }).success).toBe(false);
    expect(blogPostSchema.safeParse({ ...valid, excerpt: "x".repeat(301) }).success).toBe(false);
  });
});
