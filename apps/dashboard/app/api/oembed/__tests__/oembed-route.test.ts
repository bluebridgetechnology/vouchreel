import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import * as oembedModule from "@/lib/oembed";
import * as rateLimitModule from "@/lib/rate-limit";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map([["x-forwarded-for", "1.2.3.4"]])),
}));

describe("oEmbed Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when url param is missing", async () => {
    const req = new Request("http://localhost/api/oembed");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Missing required 'url' query parameter");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    vi.spyOn(rateLimitModule, "rateLimit").mockReturnValue({
      success: false,
      remaining: 0,
      reset: Date.now() + 30000,
    });

    const req = new Request("http://localhost/api/oembed?url=https://youtube.com/watch?v=123");
    const res = await GET(req);

    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error).toContain("Too many requests");
  });

  it("returns normalized metadata when oEmbed succeeds", async () => {
    vi.spyOn(rateLimitModule, "rateLimit").mockReturnValue({
      success: true,
      remaining: 29,
      reset: Date.now() + 60000,
    });

    vi.spyOn(oembedModule, "getOEmbedMetadata").mockResolvedValue({
      platform: "youtube",
      title: "Great Product",
      thumbnailUrl: "https://i.ytimg.com/vi/123/hqdefault.jpg",
      durationSeconds: 120,
      embedUrl: "https://www.youtube-nocookie.com/embed/123",
    });

    const req = new Request("http://localhost/api/oembed?url=https://youtube.com/watch?v=123");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.platform).toBe("youtube");
    expect(json.title).toBe("Great Product");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("29");
  });

  it("returns 404 when video is not found or private", async () => {
    vi.spyOn(rateLimitModule, "rateLimit").mockReturnValue({
      success: true,
      remaining: 29,
      reset: Date.now() + 60000,
    });

    vi.spyOn(oembedModule, "getOEmbedMetadata").mockRejectedValue(
      new oembedModule.OEmbedError("YouTube video not found or is private", 404)
    );

    const req = new Request("http://localhost/api/oembed?url=https://youtube.com/watch?v=404video");
    const res = await GET(req);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBe("YouTube video not found or is private");
  });
});
