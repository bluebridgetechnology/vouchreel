import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "../route";
import { getSession } from "@/lib/auth/session";
import { verifySpaceAccess } from "@/lib/auth/permissions";
import { canAccess } from "@/lib/auth/feature-gate";
import { db } from "@/lib/db";
import { forbidden } from "@/lib/api/errors";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/auth/permissions", () => ({
  verifySpaceAccess: vi.fn(),
}));

vi.mock("@/lib/auth/feature-gate", () => ({
  canAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

describe("White-Label API Routes (Sprint 14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/spaces/[id]/white-label", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);
      const res = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 if user lacks access to space", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-unauthorized" },
      });
      (verifySpaceAccess as any).mockResolvedValue({
        success: false,
        errorResponse: forbidden("You do not have access to this space"),
      });

      const res = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1" }),
      });
      expect(res.status).toBe(403);
    });

    it("returns white label settings and entitlement status", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-owner" },
      });
      (verifySpaceAccess as any).mockResolvedValue({
        success: true,
        access: {
          role: "owner",
          isDirectOwner: true,
          space: { id: "space-1", ownerId: "user-owner" },
        },
      });
      (canAccess as any).mockResolvedValue(true);

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: "wl-1",
              spaceId: "space-1",
              logoUrl: "https://example.com/logo.png",
              customDomain: "reviews.client.com",
              cnameVerified: true,
              removeBranding: true,
              customEmailSender: "Testimonials <feedback@client.com>",
            },
          ]),
        }),
      });

      const res = await GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.isEntitled).toBe(true);
      expect(json.whiteLabelSettings.logoUrl).toBe("https://example.com/logo.png");
      expect(json.whiteLabelSettings.removeBranding).toBe(true);
    });
  });

  describe("PUT /api/spaces/[id]/white-label", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);
      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ removeBranding: true }),
      });
      const res = await PUT(req, {
        params: Promise.resolve({ id: "space-1" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 when user lacks editor permission", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-viewer" },
      });
      (verifySpaceAccess as any).mockResolvedValue({
        success: false,
        errorResponse: forbidden("Forbidden: 'viewer' role lacks permission."),
      });

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ removeBranding: true }),
      });
      const res = await PUT(req, {
        params: Promise.resolve({ id: "space-1" }),
      });
      expect(res.status).toBe(403);
    });

    it("returns 403 when space owner lacks Agency entitlement and attempts removeBranding", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-pro" },
      });
      (verifySpaceAccess as any).mockResolvedValue({
        success: true,
        access: {
          role: "owner",
          isDirectOwner: true,
          space: { id: "space-1", ownerId: "user-pro" },
        },
      });
      (canAccess as any).mockResolvedValue(false); // Pro does not have white-label

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ removeBranding: true }),
      });
      const res = await PUT(req, {
        params: Promise.resolve({ id: "space-1" }),
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error.message).toContain("Agency plan");
    });

    it("successfully updates white-label settings for entitled owner", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-agency" },
      });
      (verifySpaceAccess as any).mockResolvedValue({
        success: true,
        access: {
          role: "owner",
          isDirectOwner: true,
          space: { id: "space-1", ownerId: "user-agency" },
        },
      });
      (canAccess as any).mockResolvedValue(true);

      // Check existing
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "wl-existing" }]),
        }),
      });

      const updatedRow = {
        id: "wl-existing",
        spaceId: "space-1",
        logoUrl: "https://brand.com/logo.svg",
        customDomain: "reviews.brand.com",
        cnameVerified: false,
        removeBranding: true,
        customEmailSender: "Brand <hello@brand.com>",
      };

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedRow]),
          }),
        }),
      });

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({
          logoUrl: "https://brand.com/logo.svg",
          customDomain: "reviews.brand.com",
          removeBranding: true,
          customEmailSender: "Brand <hello@brand.com>",
        }),
      });

      const res = await PUT(req, {
        params: Promise.resolve({ id: "space-1" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.whiteLabelSettings.logoUrl).toBe("https://brand.com/logo.svg");
      expect(json.whiteLabelSettings.removeBranding).toBe(true);
      expect(json.isEntitled).toBe(true);
    });
  });
});
