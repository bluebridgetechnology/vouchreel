import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateUrl,
  detectPlatform,
  extractYouTubeId,
  extractVimeoId,
  getOEmbedMetadata,
  isPrivateOrLocalHost,
  OEmbedError,
} from "../index";

describe("oEmbed Module", () => {
  describe("isPrivateOrLocalHost & SSRF protection", () => {
    it("blocks localhost and loopback addresses", () => {
      expect(isPrivateOrLocalHost("localhost")).toBe(true);
      expect(isPrivateOrLocalHost("127.0.0.1")).toBe(true);
      expect(isPrivateOrLocalHost("0.0.0.0")).toBe(true);
      expect(isPrivateOrLocalHost("::1")).toBe(true);
    });

    it("blocks private network ranges", () => {
      expect(isPrivateOrLocalHost("10.0.0.1")).toBe(true);
      expect(isPrivateOrLocalHost("172.16.0.5")).toBe(true);
      expect(isPrivateOrLocalHost("172.31.255.255")).toBe(true);
      expect(isPrivateOrLocalHost("192.168.1.100")).toBe(true);
      expect(isPrivateOrLocalHost("169.254.169.254")).toBe(true);
    });

    it("blocks cloud metadata hostnames", () => {
      expect(isPrivateOrLocalHost("metadata.google.internal")).toBe(true);
    });

    it("allows public hostnames", () => {
      expect(isPrivateOrLocalHost("youtube.com")).toBe(false);
      expect(isPrivateOrLocalHost("vimeo.com")).toBe(false);
      expect(isPrivateOrLocalHost("cdn.example.com")).toBe(false);
    });

    it("validateUrl throws on private addresses or invalid URLs", () => {
      expect(() => validateUrl("not-a-url")).toThrow(OEmbedError);
      expect(() => validateUrl("http://localhost:3000/test")).toThrow(OEmbedError);
      expect(() => validateUrl("http://127.0.0.1/video.mp4")).toThrow(OEmbedError);
      expect(() => validateUrl("ftp://youtube.com/watch?v=123")).toThrow(OEmbedError);
    });
  });

  describe("Platform detection & ID extraction", () => {
    it("detects YouTube watch URLs and extracts ID", () => {
      const url = new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(detectPlatform(url)).toBe("youtube");
      expect(extractYouTubeId(url)).toBe("dQw4w9WgXcQ");
    });

    it("detects youtu.be short URLs and extracts ID", () => {
      const url = new URL("https://youtu.be/dQw4w9WgXcQ");
      expect(detectPlatform(url)).toBe("youtube");
      expect(extractYouTubeId(url)).toBe("dQw4w9WgXcQ");
    });

    it("detects YouTube shorts and embed URLs", () => {
      const shortsUrl = new URL("https://www.youtube.com/shorts/dQw4w9WgXcQ");
      expect(detectPlatform(shortsUrl)).toBe("youtube");
      expect(extractYouTubeId(shortsUrl)).toBe("dQw4w9WgXcQ");

      const embedUrl = new URL("https://www.youtube.com/embed/dQw4w9WgXcQ");
      expect(detectPlatform(embedUrl)).toBe("youtube");
      expect(extractYouTubeId(embedUrl)).toBe("dQw4w9WgXcQ");
    });

    it("detects Vimeo URLs and extracts ID", () => {
      const url = new URL("https://vimeo.com/76979871");
      expect(detectPlatform(url)).toBe("vimeo");
      expect(extractVimeoId(url)).toBe("76979871");
    });

    it("detects MP4 URLs", () => {
      const url = new URL("https://example.com/videos/customer-story.mp4");
      expect(detectPlatform(url)).toBe("mp4");
    });

    it("throws on unsupported platforms", () => {
      const url = new URL("https://dailymotion.com/video/x12345");
      expect(() => detectPlatform(url)).toThrow(OEmbedError);
    });
  });

  describe("getOEmbedMetadata", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("fetches and formats YouTube metadata", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          title: "Amazing Customer Review",
          thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
          author_name: "Customer Channel",
        }),
      } as Response);

      const result = await getOEmbedMetadata("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

      expect(result.platform).toBe("youtube");
      expect(result.title).toBe("Amazing Customer Review");
      expect(result.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
      expect(result.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    });

    it("handles YouTube 404 cleanly", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(
        getOEmbedMetadata("https://www.youtube.com/watch?v=nonexistent")
      ).rejects.toThrow("YouTube video not found or is private");
    });

    it("fetches and formats Vimeo metadata with duration", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          title: "Vimeo Success Story",
          thumbnail_url: "https://i.vimeocdn.com/video/12345.jpg",
          duration: 125,
          video_id: 76979871,
        }),
      } as Response);

      const result = await getOEmbedMetadata("https://vimeo.com/76979871");

      expect(result.platform).toBe("vimeo");
      expect(result.title).toBe("Vimeo Success Story");
      expect(result.thumbnailUrl).toBe("https://i.vimeocdn.com/video/12345.jpg");
      expect(result.durationSeconds).toBe(125);
      expect(result.embedUrl).toBe("https://player.vimeo.com/video/76979871");
    });

    it("formats MP4 metadata from filename", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as Response);

      const result = await getOEmbedMetadata("https://assets.mycompany.com/testimonials/sarah-interview.mp4");

      expect(result.platform).toBe("mp4");
      expect(result.title).toBe("Sarah interview");
      expect(result.thumbnailUrl).toContain("data:image/svg+xml");
      expect(result.embedUrl).toBe("https://assets.mycompany.com/testimonials/sarah-interview.mp4");
    });
  });
});
