import { describe, it, expect } from "vitest";
import {
  normalizePath,
  matchPattern,
  matchTags,
  isPageAllowed,
  filterTestimonials,
  filterReviews,
  TestimonialItem,
  ReviewItem,
} from "../matcher";

describe("URL and Tag Matcher Module", () => {
  describe("normalizePath", () => {
    it("normalizes root and empty paths", () => {
      expect(normalizePath("")).toBe("/");
      expect(normalizePath("/")).toBe("/");
    });

    it("strips trailing slashes from subpaths", () => {
      expect(normalizePath("/pricing/")).toBe("/pricing");
      expect(normalizePath("/products/shoes/")).toBe("/products/shoes");
    });

    it("strips query parameters and hashes", () => {
      expect(normalizePath("/pricing?ref=google&utm_source=twitter")).toBe("/pricing");
      expect(normalizePath("/about#team")).toBe("/about");
      expect(normalizePath("/products/123/?tab=reviews#top")).toBe("/products/123");
    });

    it("ensures leading slash", () => {
      expect(normalizePath("dashboard/settings")).toBe("/dashboard/settings");
    });
  });

  describe("matchPattern", () => {
    it("matches universal wildcard patterns", () => {
      expect(matchPattern("*", "/anything")).toBe(true);
      expect(matchPattern("/*", "/anything")).toBe(true);
      expect(matchPattern("/**", "/anything/nested/path")).toBe(true);
    });

    it("matches exact paths and ignores trailing slashes", () => {
      expect(matchPattern("/pricing", "/pricing")).toBe(true);
      expect(matchPattern("/pricing", "/pricing/")).toBe(true);
      expect(matchPattern("/pricing/", "/pricing")).toBe(true);
      expect(matchPattern("/pricing", "/pricing-plans")).toBe(false);
      expect(matchPattern("/pricing", "/about")).toBe(false);
    });

    it("matches single segment glob (*)", () => {
      expect(matchPattern("/products/*", "/products/shoes")).toBe(true);
      expect(matchPattern("/products/*", "/products/12345")).toBe(true);
      expect(matchPattern("/products/*", "/about")).toBe(false);
      // Single * should not cross multiple segments
      expect(matchPattern("/products/*", "/products/shoes/reviews")).toBe(false);
    });

    it("matches multi-segment glob (**)", () => {
      expect(matchPattern("/docs/**", "/docs/api")).toBe(true);
      expect(matchPattern("/docs/**", "/docs/api/v1/endpoints")).toBe(true);
      expect(matchPattern("/docs/**", "/blog/post-1")).toBe(false);
    });

    it("matches patterns with query strings on incoming path", () => {
      expect(matchPattern("/checkout", "/checkout?step=2")).toBe(true);
      expect(matchPattern("/products/*", "/products/boots?color=black#details")).toBe(true);
    });
  });

  describe("matchTags", () => {
    it("returns true when no required tags are specified", () => {
      expect(matchTags([], ["saas"])).toBe(true);
      expect(matchTags(undefined, ["saas"])).toBe(true);
      expect(matchTags(null, ["saas"])).toBe(true);
    });

    it("returns false when required tags specified but host has no tags", () => {
      expect(matchTags(["saas"], [])).toBe(false);
      expect(matchTags(["saas"], null)).toBe(false);
    });

    it("matches case-insensitively when tag is present", () => {
      expect(matchTags(["SaaS"], ["saas", "b2b"])).toBe(true);
      expect(matchTags(["ecommerce"], ["saas", "b2b"])).toBe(false);
    });
  });

  describe("isPageAllowed", () => {
    it("allows page by default when no config is provided", () => {
      expect(isPageAllowed(undefined, "/pricing")).toBe(true);
    });

    it("blocks page when path matches pagesExcluded", () => {
      const config = {
        pagesIncluded: ["*"],
        pagesExcluded: ["/admin/**", "/checkout"],
      };

      expect(isPageAllowed(config, "/admin/settings")).toBe(false);
      expect(isPageAllowed(config, "/checkout")).toBe(false);
      expect(isPageAllowed(config, "/pricing")).toBe(true);
    });

    it("allows page only when matching pagesIncluded", () => {
      const config = {
        pagesIncluded: ["/products/*", "/pricing"],
        pagesExcluded: [],
      };

      expect(isPageAllowed(config, "/pricing")).toBe(true);
      expect(isPageAllowed(config, "/products/hats")).toBe(true);
      expect(isPageAllowed(config, "/blog")).toBe(false);
    });
  });

  describe("filterTestimonials", () => {
    const mockTestimonials: TestimonialItem[] = [
      {
        id: "all-1",
        videoUrl: "https://youtube.com/watch?v=111",
        platform: "youtube",
        matchRules: { mode: "all" },
      },
      {
        id: "pricing-only",
        videoUrl: "https://youtube.com/watch?v=222",
        platform: "youtube",
        matchRules: { mode: "specific", urlPatterns: ["/pricing"] },
      },
      {
        id: "products-wildcard",
        videoUrl: "https://youtube.com/watch?v=333",
        platform: "youtube",
        matchRules: { mode: "specific", urlPatterns: ["/products/*"] },
      },
      {
        id: "tag-matched",
        videoUrl: "https://youtube.com/watch?v=444",
        platform: "youtube",
        matchRules: { mode: "specific", urlPatterns: ["*"], tags: ["b2b"] },
      },
    ];

    it("includes 'all' testimonials on every page", () => {
      const matched = filterTestimonials(mockTestimonials, { pathname: "/about" }, []);
      expect(matched.map((t) => t.id)).toEqual(["all-1"]);
    });

    it("filters testimonials specific to /pricing", () => {
      const matched = filterTestimonials(mockTestimonials, { pathname: "/pricing" }, []);
      expect(matched.map((t) => t.id)).toEqual(["all-1", "pricing-only"]);
    });

    it("filters testimonials with glob patterns like /products/*", () => {
      const matched = filterTestimonials(mockTestimonials, { pathname: "/products/shoes" }, []);
      expect(matched.map((t) => t.id)).toEqual(["all-1", "products-wildcard"]);
    });

    it("filters testimonials requiring specific host page tags", () => {
      const matched = filterTestimonials(mockTestimonials, { pathname: "/landing" }, ["b2b"]);
      expect(matched.map((t) => t.id)).toEqual(["all-1", "tag-matched"]);
    });

    it("returns empty array if input array is empty", () => {
      expect(filterTestimonials([], { pathname: "/pricing" })).toEqual([]);
    });
  });

  describe("filterReviews", () => {
    const mockReviews: ReviewItem[] = [
      {
        id: "rev-all",
        provider: "google",
        authorName: "John Doe",
        rating: 5,
        text: "Great experience everywhere!",
        matchRules: { mode: "all" },
      },
      {
        id: "rev-pricing",
        provider: "trustpilot",
        authorName: "Jane Smith",
        rating: 5,
        text: "Loved the clear pricing",
        matchRules: { mode: "specific", urlPatterns: ["/pricing"] },
      },
      {
        id: "rev-enterprise",
        provider: "google",
        authorName: "Enterprise Client",
        rating: 5,
        text: "Huge ROI",
        matchRules: { mode: "specific", tags: ["enterprise"] },
      },
    ];

    it("includes reviews with mode 'all' on any page", () => {
      const result = filterReviews(mockReviews, { pathname: "/about" });
      expect(result.map((r) => r.id)).toEqual(["rev-all"]);
    });

    it("matches URL specific reviews", () => {
      const result = filterReviews(mockReviews, { pathname: "/pricing" });
      expect(result.map((r) => r.id)).toEqual(["rev-all", "rev-pricing"]);
    });

    it("matches tag specific reviews", () => {
      const result = filterReviews(mockReviews, { pathname: "/pricing" }, ["enterprise"]);
      expect(result.map((r) => r.id)).toEqual(["rev-all", "rev-pricing", "rev-enterprise"]);
    });

    it("returns empty array for empty input", () => {
      expect(filterReviews([])).toEqual([]);
    });
  });
});

