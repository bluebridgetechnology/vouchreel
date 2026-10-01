import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GET as getSettings,
  PUT as updateSettings,
} from "../route";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getSubscriptionLimits } from "@/lib/payments/subscription";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/payments/subscription", () => ({
  getSubscriptionLimits: vi.fn(),
}));

describe("Social Export Settings API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/spaces/[id]/social-export-settings", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const res = await getSettings(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 when space is owned by another user", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "space-1", ownerId: "other-user" },
          ]),
        }),
      });

      const res = await getSettings(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1" }),
      });
      expect(res.status).toBe(403);
    });

    it("returns default settings when none exist in database", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      // 1. space query -> found
      // 2. settings query -> empty
      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "space-1", ownerId: "user-1" },
            ]),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      (getSubscriptionLimits as any).mockResolvedValue({
        removeWatermark: false,
        canCustomizeBranding: false,
      });

      const res = await getSettings(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1" }),
      });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.settings.spaceId).toBe("space-1");
      expect(json.settings.showWatermark).toBe(true);
      expect(json.settings.defaultFraming).toBe("blur");
      expect(json.limits.canRemoveWatermark).toBe(false);
    });
  });

  describe("PUT /api/spaces/[id]/social-export-settings", () => {
    it("returns 400 on invalid payload", async () => {
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

      const res = await updateSettings(
        new Request("http://localhost", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandColor: "invalid-color" }),
        }),
        { params: Promise.resolve({ id: "space-1" }) }
      );

      expect(res.status).toBe(400);
    });

    it("enforces showWatermark=true if user is on Free tier", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      // Space check
      (db.select as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: "space-1", ownerId: "user-1" },
            ]),
          }),
        })
        // Existing settings check
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        });

      (getSubscriptionLimits as any).mockResolvedValue({
        removeWatermark: false,
        canCustomizeBranding: false,
      });

      const insertMock = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "setting-1",
            spaceId: "space-1",
            brandColor: "#6366f1",
            showWatermark: true, // enforced
          },
        ]),
      });
      (db.insert as any).mockReturnValue({ values: insertMock });

      const res = await updateSettings(
        new Request("http://localhost", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandColor: "#6366f1",
            showWatermark: false, // User requested false, but is on free tier
          }),
        }),
        { params: Promise.resolve({ id: "space-1" }) }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.settings.showWatermark).toBe(true);
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          showWatermark: true,
        })
      );
    });
  });
});
