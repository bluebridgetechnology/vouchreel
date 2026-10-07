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
    (rateLimit as any).mockResolvedValue({
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
    (rateLimit as any).mockResolvedValue({
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

  describe("an id that is not a testimonial (a made video in the widget)", () => {
    const madeVideoId = "c2aabb77-7a2b-4ed6-9b4d-4bb7bd160c33";
    const insert = vi.fn().mockResolvedValue(undefined);

    function post(testimonialIds: (string | undefined)[]) {
      // First lookup: the space. Second: which of the named ids are testimonials.
      const rows = [[{ id: validSpaceId }], [{ id: validTestimonialId }]];
      (db.select as any).mockImplementation(() => ({ from: () => ({ where: () => Promise.resolve(rows.shift() ?? []) }) }));
      insert.mockClear();
      (db.insert as any).mockReturnValue({ values: insert });
      return postEvents(
        new Request("http://localhost/api/events", {
          method: "POST",
          body: JSON.stringify({ events: testimonialIds.map((testimonialId) => ({ spaceId: validSpaceId, testimonialId, sessionId: "s", eventType: "play" })) }),
        })
      );
    }

    it("is still counted for the space, instead of failing the whole batch on the foreign key", async () => {
      const res = await post([madeVideoId]);
      expect(res.status).toBe(201);
      expect(insert.mock.calls[0][0]).toEqual([expect.objectContaining({ spaceId: validSpaceId, testimonialId: null, eventType: "play" })]);
    });

    it("leaves real testimonials attributed, in the same batch", async () => {
      const res = await post([validTestimonialId, madeVideoId, undefined]);
      expect(res.status).toBe(201);
      expect(insert.mock.calls[0][0].map((e: { testimonialId: string | null }) => e.testimonialId)).toEqual([validTestimonialId, null, null]);
    });
  });
});
