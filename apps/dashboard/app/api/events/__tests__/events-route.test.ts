import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as postEvents, OPTIONS as optionsEvents } from "../route";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(),
}));

describe("Analytics Events API Route", () => {
  const validSpaceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const validTestimonialId = "b1ffcd88-8b1a-4fe7-aa5c-5aa8ac271b22";

  beforeEach(() => {
    vi.clearAllMocks();
    (rateLimit as any).mockReturnValue({
      success: true,
      remaining: 90,
      reset: Date.now() + 600000,
    });
  });

  it("handles OPTIONS preflight with CORS headers", async () => {
    // sendBeacon sends credentialed cross-origin requests, so the origin must be
    // reflected (wildcard is rejected by browsers for credentials mode "include")
    const req = new Request("http://localhost/api/events", {
      method: "OPTIONS",
      headers: { Origin: "https://customer-site.example" },
    });
    const res = await optionsEvents(req);
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://customer-site.example");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(res.headers.get("Vary")).toBe("Origin");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  it("falls back to wildcard CORS when no Origin header is present", async () => {
    const res = await optionsEvents(new Request("http://localhost/api/events", { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns 400 on empty body", async () => {
    const req = new Request("http://localhost/api/events", {
      method: "POST",
      body: "",
    });

    const res = await postEvents(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toBe("Request body cannot be empty");
  });

  it("returns 400 on invalid schema payload", async () => {
    const req = new Request("http://localhost/api/events", {
      method: "POST",
      body: JSON.stringify({ events: [{ eventType: "invalid-type" }] }),
    });

    const res = await postEvents(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toBe("Validation failed");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    (rateLimit as any).mockReturnValue({
      success: false,
      remaining: 0,
      reset: Date.now() + 300000,
    });

    const payload = {
      events: [
        {
          spaceId: validSpaceId,
          sessionId: "sess-spam",
          eventType: "impression",
        },
      ],
    };

    const req = new Request("http://localhost/api/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const res = await postEvents(req);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.error.code).toBe("RATE_LIMITED");
    expect(json.error.message).toContain("Rate limit exceeded");
  });

  it("returns 404 when spaceId does not exist", async () => {
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]), // Space not found
      }),
    });

    const payload = {
      events: [
        {
          spaceId: validSpaceId,
          sessionId: "sess-1",
          eventType: "impression",
        },
      ],
    };

    const req = new Request("http://localhost/api/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const res = await postEvents(req);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.message).toContain("Space not found");
  });

  it("records valid batched events successfully", async () => {
    // Space exists
    (db.select as any).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: validSpaceId }]),
      }),
    });

    (db.insert as any).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    const payload = {
      events: [
        {
          spaceId: validSpaceId,
          testimonialId: validTestimonialId,
          sessionId: "sess-user-1",
          eventType: "impression",
          pageUrl: "https://example.com/pricing",
        },
        {
          spaceId: validSpaceId,
          testimonialId: validTestimonialId,
          sessionId: "sess-user-1",
          eventType: "play",
          pageUrl: "https://example.com/pricing",
        },
      ],
    };

    const req = new Request("http://localhost/api/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const res = await postEvents(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.count).toBe(2);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
