import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

const upload = vi.fn(async () => "https://cdn.test/video.mp4");
let collectModes: "both" | "video" | "text" = "both";
const insertValues = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => Promise.resolve([{ id: "form-1", spaceId: "space-1", collectModes }]) }),
    }),
    insert: () => ({
      values: (v: unknown) => {
        insertValues(v);
        return { returning: () => Promise.resolve([{ id: "sub-1", ...(v as object) }]) };
      },
    }),
  },
}));
vi.mock("@/lib/storage", () => ({ getStorage: () => ({ upload }) }));
vi.mock("@/lib/transcode", () => ({ queueTranscode: vi.fn() }));
vi.mock("@/lib/webhooks/dispatch", () => ({ dispatchWebhookEvent: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/notifications/service", () => ({ notifySpaceOwner: vi.fn() }));

const ctx = { params: Promise.resolve({ slug: "acme" }) };
const mp4Head = Uint8Array.from([0, 0, 0, 0x20, ...[..."ftypisom"].map((c) => c.charCodeAt(0)), 0, 0, 0, 0]);
const exeHead = Uint8Array.from([...[..."MZ"].map((c) => c.charCodeAt(0)), 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff]);

function form(fields: Record<string, string | Blob>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const base = { customerName: "Ada", customerEmail: "ada@example.com" };

function request(body: FormData, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/collect/acme/submissions", { method: "POST", body, headers });
}

describe("POST /api/collect/[slug]/submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
    collectModes = "both";
  });

  it("accepts a real MP4 and stores it", async () => {
    const video = new File([mp4Head, new Uint8Array(64)], "clip.mp4", { type: "video/mp4" });
    const res = await POST(request(form({ ...base, video })), ctx);
    expect(res.status).toBe(201);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("rejects an executable disguised as video/mp4 before storing anything", async () => {
    const fake = new File([exeHead, new Uint8Array(64)], "clip.mp4", { type: "video/mp4" });
    const res = await POST(request(form({ ...base, video: fake })), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/valid MP4/i);
    expect(upload).not.toHaveBeenCalled();
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("rejects an oversized declared body with 413 without reading it", async () => {
    const res = await POST(
      request(form({ ...base, text: "hi" }), { "content-length": String(150 * 1024 * 1024) }),
      ctx
    );
    expect(res.status).toBe(413);
  });

  it("accepts a plain text testimonial", async () => {
    const res = await POST(request(form({ ...base, text: "Loved it" })), ctx);
    expect(res.status).toBe(201);
    expect(upload).not.toHaveBeenCalled();
  });

  it("records AI video consent with the wording version for a written testimonial", async () => {
    const res = await POST(request(form({ ...base, text: "Loved it", aiVideoConsent: "true" })), ctx);
    expect(res.status).toBe(201);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ aiVideoConsentAt: expect.any(Date), aiVideoConsentVersion: "2026-10-v1" })
    );
  });

  it("records no consent unless the box was ticked", async () => {
    await POST(request(form({ ...base, text: "Loved it" })), ctx);
    expect(insertValues.mock.calls[0][0]).not.toHaveProperty("aiVideoConsentAt");
  });

  it("never records AI video consent on a video submission", async () => {
    const video = new File([mp4Head, new Uint8Array(64)], "clip.mp4", { type: "video/mp4" });
    await POST(request(form({ ...base, video, aiVideoConsent: "true" })), ctx);
    expect(insertValues.mock.calls[0][0]).not.toHaveProperty("aiVideoConsentAt");
  });

  it("accepts a browser recording whose MIME type carries codec parameters", async () => {
    const webm = Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const video = new File([webm, new Uint8Array(64)], "testimonial.webm", { type: "video/webm;codecs=vp8,opus" });
    const res = await POST(request(form({ ...base, video })), ctx);
    expect(res.status).toBe(201);
    expect(upload).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/\.webm$/), expect.objectContaining({ contentType: "video/webm" }));
  });

  it("rejects a written testimonial on a video-only form", async () => {
    collectModes = "video";
    const res = await POST(request(form({ ...base, text: "Loved it" })), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/only accepts video/i);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("rejects a video on a written-only form before storing it", async () => {
    collectModes = "text";
    const video = new File([mp4Head, new Uint8Array(64)], "clip.mp4", { type: "video/mp4" });
    const res = await POST(request(form({ ...base, video })), ctx);
    expect(res.status).toBe(400);
    expect((await res.json()).error.message).toMatch(/only accepts written/i);
    expect(upload).not.toHaveBeenCalled();
  });

  it("still accepts the allowed type on single-option forms", async () => {
    collectModes = "text";
    expect((await POST(request(form({ ...base, text: "Loved it" })), ctx)).status).toBe(201);
  });

  it("rate limits per client IP taken from the trusted end of x-forwarded-for", async () => {
    // Forging the first hop must not create a fresh bucket each time
    for (let i = 0; i < 10; i++) {
      const res = await POST(
        request(form({ ...base, text: "t" + i }), { "x-forwarded-for": `1.1.1.${i}, 203.0.113.9` }),
        ctx
      );
      expect(res.status).toBe(201);
    }
    const blocked = await POST(request(form({ ...base, text: "eleven" }), { "x-forwarded-for": "9.9.9.9, 203.0.113.9" }), ctx);
    expect(blocked.status).toBe(429);
    expect(await rateLimit("unrelated")).toMatchObject({ success: true });
  });
});
