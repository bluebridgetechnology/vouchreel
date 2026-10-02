import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "../../../app/api/admin/settings/route";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      adminSettings: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}));

vi.mock("@/lib/payments", () => ({
  getActivePaymentProviderName: vi.fn().mockResolvedValue("stripe"),
}));

describe("Admin Settings Route Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("platform admin separation", () => {
    it("rejects PUT from a regular account owner even with role=owner or admin", async () => {
      for (const role of ["owner", "admin"]) {
        (getSession as any).mockResolvedValue({
          user: { id: "user-1", email: "customer@test.com", role },
        });
        const response = await PUT(
          new Request("http://localhost/api/admin/settings", {
            method: "PUT",
            body: JSON.stringify({ payment_provider: "dodo" }),
          })
        );
        expect(response.status).toBe(403);
      }
    });
  });

  describe("GET /api/admin/settings", () => {
    it("returns 401 when not authenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const response = await GET();
      expect(response.status).toBe(401);
    });

    it("returns 403 for a regular account owner (not a platform admin)", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com", role: "owner", isPlatformAdmin: false },
      });

      const response = await GET();
      expect(response.status).toBe(403);
    });

    it("returns payment provider for a platform admin", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "owner@test.com", role: "owner", isPlatformAdmin: true },
      });

      const response = await GET();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.payment_provider).toBe("stripe");
    });
  });

  describe("PUT /api/admin/settings", () => {
    it("returns 401 when not authenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const request = new Request("http://localhost/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ payment_provider: "dodo" }),
      });

      const response = await PUT(request);
      expect(response.status).toBe(401);
    });

    it("returns 403 when user is not admin", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", role: "viewer" },
      });

      const request = new Request("http://localhost/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ payment_provider: "dodo" }),
      });

      const response = await PUT(request);
      expect(response.status).toBe(403);
    });

    it("returns 400 for invalid payment provider name", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", role: "owner", isPlatformAdmin: true },
      });

      const request = new Request("http://localhost/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ payment_provider: "invalid_crypto" }),
      });

      const response = await PUT(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error.message).toContain("Must be either 'stripe' or 'dodo'");
    });

    it("successfully updates payment provider to dodo", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", role: "owner", isPlatformAdmin: true },
      });
      (db.query.adminSettings.findFirst as any).mockResolvedValue(null);

      const request = new Request("http://localhost/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ payment_provider: "dodo" }),
      });

      const response = await PUT(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.payment_provider).toBe("dodo");
      expect(db.insert).toHaveBeenCalled();
    });
  });
});
