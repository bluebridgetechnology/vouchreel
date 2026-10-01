import { describe, it, expect } from "vitest";
import {
  extractYouTubeId,
  extractVimeoId,
  detectPlatform,
  getThumbnailUrl,
} from "../player";

describe("Video Player Helpers", () => {
  describe("extractYouTubeId", () => {
    it("extracts ID from standard watch URL", () => {
      expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(extractYouTubeId("https://youtube.com/watch?v=abc123XYZ&t=30s")).toBe("abc123XYZ");
    });

    it("extracts ID from short youtu.be URL", () => {
      expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("extracts ID from embed and nocookie URLs", () => {
      expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
      expect(extractYouTubeId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("extracts ID from shorts URL", () => {
      expect(extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });

    it("returns null for invalid or non-YouTube URLs", () => {
      expect(extractYouTubeId("")).toBeNull();
      expect(extractYouTubeId("https://vimeo.com/123456")).toBeNull();
      expect(extractYouTubeId("https://example.com/video.mp4")).toBeNull();
    });
  });

  describe("extractVimeoId", () => {
    it("extracts ID from standard vimeo URL", () => {
      expect(extractVimeoId("https://vimeo.com/76979871")).toBe("76979871");
    });

    it("extracts ID from player.vimeo.com URL", () => {
      expect(extractVimeoId("https://player.vimeo.com/video/76979871")).toBe("76979871");
    });

    it("returns null for invalid or non-Vimeo URLs", () => {
      expect(extractVimeoId("")).toBeNull();
      expect(extractVimeoId("https://youtube.com/watch?v=123")).toBeNull();
    });
  });

  describe("detectPlatform", () => {
    it("detects youtube URLs", () => {
      expect(detectPlatform("https://youtube.com/watch?v=123")).toBe("youtube");
      expect(detectPlatform("https://youtu.be/123")).toBe("youtube");
    });

    it("detects vimeo URLs", () => {
      expect(detectPlatform("https://vimeo.com/123")).toBe("vimeo");
    });

    it("defaults to mp4 for direct video files or others", () => {
      expect(detectPlatform("https://cdn.example.com/testimonials/clip.mp4")).toBe("mp4");
      expect(detectPlatform("")).toBe("mp4");
    });
  });

  describe("getThumbnailUrl", () => {
    it("returns provided thumbnail if specified", () => {
      const thumb = getThumbnailUrl(
        "https://youtube.com/watch?v=123",
        "youtube",
        "https://custom.com/thumb.jpg"
      );
      expect(thumb).toBe("https://custom.com/thumb.jpg");
    });

    it("generates YouTube hqdefault thumbnail when no custom thumbnail is provided", () => {
      const thumb = getThumbnailUrl("https://youtube.com/watch?v=dQw4w9WgXcQ", "youtube");
      expect(thumb).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    });
  });
});
