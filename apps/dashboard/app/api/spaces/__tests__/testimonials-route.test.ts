import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GET as listTestimonials,
  POST as createTestimonial,
} from "../[id]/testimonials/route";
import {
  GET as getTestimonial,
  PUT as updateTestimonial,
  DELETE as deleteTestimonial,
} from "../[id]/testimonials/[tid]/route";
import { PUT as reorderTestimonials } from "../[id]/testimonials/reorder/route";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import * as oembedModule from "@/lib/oembed";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

const permanentDelete = vi.hoisted(() => vi.fn());
vi.mock("@/lib/spaces/delete", () => ({ deleteTestimonialPermanently: permanentDelete }));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Testimonial API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/spaces/[id]/testimonials", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const res = await listTestimonials(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 if space is owned by another user", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "space-1", ownerId: "user-other" },
          ]),
        }),
      });

      const res = await listTestimonials(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1" }),
      });
      expect(res.status).toBe(403);
    });

    it("returns active testimonials ordered by sortOrder", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Verify space owner
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { id: "space-1", ownerId: "user-1" },
              ]),
            }),
          };
        }
        // Fetch testimonials
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                { id: "t-1", title: "Review 1", sortOrder: 0, isActive: true },
                { id: "t-2", title: "Review 2", sortOrder: 1, isActive: true },
              ]),
            }),
          }),
        };
      });

      const res = await listTestimonials(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.testimonials).toHaveLength(2);
      expect(json.testimonials[0].sortOrder).toBe(0);
    });
  });

  describe("POST /api/spaces/[id]/testimonials", () => {
    it("returns 400 for invalid video URL", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "space-1", ownerId: "user-1" },
          ]),
        }),
      });

      const req = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ videoUrl: "not-a-valid-url" }),
      });

      const res = await createTestimonial(req, {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(400);
    });

    it("creates a testimonial auto-fetching oEmbed and assigning next sortOrder", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      vi.spyOn(oembedModule, "getOEmbedMetadata").mockResolvedValue({
        platform: "youtube",
        title: "Auto Fetched Title",
        thumbnailUrl: "https://i.ytimg.com/vi/123/hqdefault.jpg",
        durationSeconds: 90,
        embedUrl: "https://www.youtube-nocookie.com/embed/123",
      });

      let selectCalls = 0;
      (db.select as any).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          // Verify space owner
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { id: "space-1", ownerId: "user-1" },
              ]),
            }),
          };
        }
        // Max sortOrder query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ maxOrder: 2 }]),
          }),
        };
      });

      const created = {
        id: "t-new",
        spaceId: "space-1",
        videoUrl: "https://www.youtube.com/watch?v=123",
        platform: "youtube",
        title: "Auto Fetched Title",
        thumbnailUrl: "https://i.ytimg.com/vi/123/hqdefault.jpg",
        durationSeconds: 90,
        sortOrder: 3,
        clipStatus: "none",
        isActive: true,
      };

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([created]),
        }),
      });

      const req = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          videoUrl: "https://www.youtube.com/watch?v=123",
          customerName: "Jane Doe",
        }),
      });

      const res = await createTestimonial(req, {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.testimonial.title).toBe("Auto Fetched Title");
      expect(json.testimonial.sortOrder).toBe(3);
      expect(json.testimonial.clipStatus).toBe("none");
    });
  });

  describe("PUT /api/spaces/[id]/testimonials/[tid]", () => {
    it("updates testimonial metadata", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      let selectCalls = 0;
      (db.select as any).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { id: "space-1", ownerId: "user-1" },
              ]),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "t-1", spaceId: "space-1", title: "Old Title" },
            ]),
          }),
        };
      });

      const updated = {
        id: "t-1",
        spaceId: "space-1",
        quote: "Updated quote",
        customerName: "Alice",
      };

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({
          quote: "Updated quote",
          customerName: "Alice",
        }),
      });

      const res = await updateTestimonial(req, {
        params: Promise.resolve({ id: "space-1", tid: "t-1" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.testimonial.quote).toBe("Updated quote");
    });
  });

  describe("DELETE /api/spaces/[id]/testimonials/[tid]", () => {
    it("deletes the testimonial for good (rows and files), no longer just switching it off", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      let selectCalls = 0;
      (db.select as any).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { id: "space-1", ownerId: "user-1" },
              ]),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "t-1", spaceId: "space-1", isActive: true },
            ]),
          }),
        };
      });

      permanentDelete.mockResolvedValue({ id: "t-1" });

      const res = await deleteTestimonial(new Request("http://localhost", { method: "DELETE" }), {
        params: Promise.resolve({ id: "space-1", tid: "t-1" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(permanentDelete).toHaveBeenCalledWith("space-1", "t-1");
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe("PUT /api/spaces/[id]/testimonials/reorder", () => {
    it("reorders testimonials successfully", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "space-1", ownerId: "user-1" },
          ]),
        }),
      });

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({
          items: [
            { id: "11111111-1111-1111-1111-111111111111", sortOrder: 0 },
            { id: "22222222-2222-2222-2222-222222222222", sortOrder: 1 },
          ],
        }),
      });

      const res = await reorderTestimonials(req, {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });
});
