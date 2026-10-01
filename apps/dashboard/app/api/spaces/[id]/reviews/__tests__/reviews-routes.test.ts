import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getReviews } from "../route";
import { POST as connectSource } from "../sources/route";
import { PATCH as updateReview, DELETE as deleteReview } from "../[reviewId]/route";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { syncReviewSource } from "@/lib/reviews/sync";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/reviews/crypto", () => ({
  encryptCredentials: vi.fn((data) => ({
    encrypted: "enc_mock",
    iv: "iv_mock",
    tag: "tag_mock",
  })),
  decryptCredentials: vi.fn((data) => data || {}),
  isEncryptedData: vi.fn(() => true),
}));

vi.mock("@/lib/reviews/sync", () => ({
  syncReviewSource: vi.fn().mockResolvedValue({
    sourceId: "source-1",
    provider: "google",
    importedCount: 5,
    updatedCount: 0,
    totalFetched: 5,
    lastSyncAt: new Date(),
  }),
}));

describe("Reviews API Routes", () => {
  const mockUser = { id: "user-123", email: "user@example.com" };
  const mockSpace = { id: "space-abc", ownerId: "user-123" };

  beforeEach(() => {
    vi.clearAllMocks();
    (getSession as any).mockResolvedValue({ user: mockUser });
  });

  describe("GET /api/spaces/[id]/reviews", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);
      const res = await getReviews(new Request("http://localhost/api/spaces/space-abc/reviews"), {
        params: Promise.resolve({ id: "space-abc" }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 403 when user does not own space", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "space-abc", ownerId: "different-user" }]),
        }),
      });

      const res = await getReviews(new Request("http://localhost/api/spaces/space-abc/reviews"), {
        params: Promise.resolve({ id: "space-abc" }),
      });

      expect(res.status).toBe(403);
    });

    it("returns reviews and sanitized sources", async () => {
      let callCount = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              // verifySpaceOwner
              return Promise.resolve([mockSpace]);
            }
            // sources query or reviews query
            return {
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: "rev-1",
                  authorName: "Alice",
                  rating: 5,
                  text: "Great!",
                  isApproved: true,
                },
              ]),
            };
          }),
        }),
      }));

      const res = await getReviews(new Request("http://localhost/api/spaces/space-abc/reviews"), {
        params: Promise.resolve({ id: "space-abc" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("reviews");
      expect(data).toHaveProperty("sources");
    });
  });

  describe("POST /api/spaces/[id]/reviews/sources", () => {
    it("validates required payload fields", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockSpace]),
        }),
      });

      const req = new Request("http://localhost/api/spaces/space-abc/reviews/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "unsupported",
        }),
      });

      const res = await connectSource(req, {
        params: Promise.resolve({ id: "space-abc" }),
      });

      expect(res.status).toBe(400);
    });

    it("creates review source and triggers sync if syncNow is true", async () => {
      let selectCount = 0;
      (db.select as any).mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(async () => {
            selectCount++;
            if (selectCount === 1) return [mockSpace]; // space owner check
            return []; // existing source check -> none
          }),
        }),
      }));

      const newSource = {
        id: "source-new",
        spaceId: "space-abc",
        provider: "google",
        providerBusinessId: "ChIJ_fake_place",
        metadata: { businessName: "Acme Place" },
      };

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newSource]),
        }),
      });

      const req = new Request("http://localhost/api/spaces/space-abc/reviews/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "google",
          providerBusinessId: "ChIJ_fake_place",
          apiKey: "AIza_fake_key",
          metadata: { businessName: "Acme Place" },
          syncNow: true,
        }),
      });

      const res = await connectSource(req, {
        params: Promise.resolve({ id: "space-abc" }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.source.id).toBe("source-new");
      expect(syncReviewSource).toHaveBeenCalledWith("source-new", { force: true });
    });
  });

  describe("PATCH /api/spaces/[id]/reviews/[reviewId]", () => {
    it("updates review moderation status", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockSpace]),
        }),
      });

      const updated = {
        id: "rev-1",
        isApproved: false,
      };

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const req = new Request("http://localhost/api/spaces/space-abc/reviews/rev-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: false }),
      });

      const res = await updateReview(req, {
        params: Promise.resolve({ id: "space-abc", reviewId: "rev-1" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.review.isApproved).toBe(false);
    });
  });

  describe("DELETE /api/spaces/[id]/reviews/[reviewId]", () => {
    it("deletes the review successfully", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockSpace]),
        }),
      });

      (db.delete as any).mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "rev-1" }]),
        }),
      });

      const req = new Request("http://localhost/api/spaces/space-abc/reviews/rev-1", {
        method: "DELETE",
      });

      const res = await deleteReview(req, {
        params: Promise.resolve({ id: "space-abc", reviewId: "rev-1" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
