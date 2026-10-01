import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import * as translationsLib from "@/lib/translations";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock("@/lib/translations", () => ({
  getOrTranslateTestimonial: vi.fn(),
}));

describe("Testimonial Translations API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/spaces/[id]/testimonials/[tid]/translations", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const res = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1", tid: "test-1" }),
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error.message).toBe("Unauthorized");
    });

    it("returns 404 when space is not found", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const res = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-missing", tid: "test-1" }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.message).toBe("Space not found");
    });

    it("returns 403 when user is not owner", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-different", email: "user@test.com" },
      });

      (db.select as any).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "space-1", ownerId: "user-owner" }]),
        }),
      });

      const res = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1", tid: "test-1" }),
      });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.message).toContain("Forbidden");
    });

    it("returns 404 when testimonial is not found in space", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "space-1", ownerId: "user-1" }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      const res = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1", tid: "test-missing" }),
      });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.message).toBe("Testimonial not found");
    });

    it("returns 200 with list of translations", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      const mockTranslations = [
        {
          id: "trans-1",
          testimonialId: "test-1",
          language: "es",
          quote: "Cita en español",
          provider: "mock",
        },
        {
          id: "trans-2",
          testimonialId: "test-1",
          language: "fr",
          quote: "Citation en français",
          provider: "mock",
        },
      ];

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "space-1", ownerId: "user-1" }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "test-1", spaceId: "space-1" }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockTranslations),
            }),
          }),
        });

      const res = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1", tid: "test-1" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.translations).toHaveLength(2);
      expect(json.translations[0].language).toBe("es");
      expect(json.translations[1].language).toBe("fr");
    });
  });

  describe("POST /api/spaces/[id]/testimonials/[tid]/translations", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const res = await POST(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: "es" }),
        }),
        { params: Promise.resolve({ id: "space-1", tid: "test-1" }) }
      );

      expect(res.status).toBe(401);
    });

    it("returns 400 when language is missing", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "space-1", ownerId: "user-1" }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "test-1", spaceId: "space-1" }]),
          }),
        });

      const res = await POST(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ id: "space-1", tid: "test-1" }) }
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.message).toContain("Language is required");
    });

    it("returns 201 with newly created translation", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "space-1", ownerId: "user-1" }]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "test-1", spaceId: "space-1" }]),
          }),
        });

      const generatedTranslation = {
        id: "trans-new",
        testimonialId: "test-1",
        language: "de",
        quote: "[DE] Awesome service!",
        provider: "mock",
      };

      (translationsLib.getOrTranslateTestimonial as any).mockResolvedValue(
        generatedTranslation
      );

      const res = await POST(
        new Request("http://localhost", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: "de" }),
        }),
        { params: Promise.resolve({ id: "space-1", tid: "test-1" }) }
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.translation.language).toBe("de");
      expect(json.translation.quote).toBe("[DE] Awesome service!");
      expect(translationsLib.getOrTranslateTestimonial).toHaveBeenCalledWith("test-1", "de");
    });
  });
});
