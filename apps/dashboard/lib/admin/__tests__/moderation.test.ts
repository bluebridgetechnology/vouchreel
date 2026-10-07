import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/storage", () => ({ getStorage: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ notifySpaceOwner: vi.fn() }));

import { storageKeyFromUrl } from "@/lib/storage/video-files";

describe("storageKeyFromUrl", () => {
  it("finds the key in S3, CDN and local-upload URLs", () => {
    expect(storageKeyFromUrl("https://cdn.example.com/ai-videos/sp1/t1/v1-abc.mp4", "ai")).toBe("ai-videos/sp1/t1/v1-abc.mp4");
    expect(storageKeyFromUrl("https://bucket.r2.dev/some/base/review-videos/sp1/v1-abc.mp4", "review")).toBe("review-videos/sp1/v1-abc.mp4");
    expect(storageKeyFromUrl("http://localhost:3000/local-uploads/ai-videos/sp%201/t1/v1.mp4", "ai")).toBe("ai-videos/sp 1/t1/v1.mp4");
  });

  it("ignores a query string or fragment", () => {
    expect(storageKeyFromUrl("https://cdn.example.com/ai-videos/s/t/v.mp4?token=1#x", "ai")).toBe("ai-videos/s/t/v.mp4");
  });

  it("refuses URLs that are not this kind of video", () => {
    expect(storageKeyFromUrl("https://cdn.example.com/review-videos/s/v.mp4", "ai")).toBeNull();
    expect(storageKeyFromUrl("https://cdn.example.com/ai-videos/s/v.mp4", "review")).toBeNull();
    expect(storageKeyFromUrl("https://cdn.example.com/uploads/video.mp4", "ai")).toBeNull();
    expect(storageKeyFromUrl("not a url", "ai")).toBeNull();
    expect(storageKeyFromUrl("", "review")).toBeNull();
  });

  it("refuses keys that could climb out of the storage folder", () => {
    expect(storageKeyFromUrl("https://cdn.example.com/ai-videos/../secrets.mp4", "ai")).toBeNull();
    expect(storageKeyFromUrl("https://cdn.example.com/ai-videos/%2e%2e/secrets.mp4", "ai")).toBeNull();
    expect(storageKeyFromUrl("https://cdn.example.com/ai-videos//double.mp4", "ai")).toBeNull();
    expect(storageKeyFromUrl("https://cdn.example.com/ai-videos/", "ai")).toBeNull();
  });
});
