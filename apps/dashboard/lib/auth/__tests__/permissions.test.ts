import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hasRolePermission,
  getSpaceAccess,
  verifySpaceAccess,
  getAccessibleSpacesWithCounts,
  type TeamRole,
} from "../permissions";
import { db } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
}));

describe("Permissions & RBAC (Sprint 14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hasRolePermission", () => {
    it("owner has access to owner, editor, and viewer actions", () => {
      expect(hasRolePermission("owner", "owner")).toBe(true);
      expect(hasRolePermission("owner", "editor")).toBe(true);
      expect(hasRolePermission("owner", "viewer")).toBe(true);
    });

    it("editor has access to editor and viewer actions, but not owner", () => {
      expect(hasRolePermission("editor", "owner")).toBe(false);
      expect(hasRolePermission("editor", "editor")).toBe(true);
      expect(hasRolePermission("editor", "viewer")).toBe(true);
    });

    it("viewer has access only to viewer actions", () => {
      expect(hasRolePermission("viewer", "owner")).toBe(false);
      expect(hasRolePermission("viewer", "editor")).toBe(false);
      expect(hasRolePermission("viewer", "viewer")).toBe(true);
    });
  });

  describe("getSpaceAccess", () => {
    it("returns owner role when user is direct space owner", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: "space-1",
              name: "Direct Space",
              ownerId: "user-1",
              embedKey: "emb_1",
            },
          ]),
        }),
      });

      const access = await getSpaceAccess("user-1", "space-1");
      expect(access).toBeDefined();
      expect(access?.role).toBe("owner");
      expect(access?.isDirectOwner).toBe(true);
      expect(access?.space.id).toBe("space-1");
    });

    it("returns team member role when user has accepted invite for space owner", async () => {
      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Call 1: fetch space
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  id: "space-2",
                  name: "Agency Space",
                  ownerId: "owner-99",
                  embedKey: "emb_2",
                },
              ]),
            }),
          };
        }
        // Call 2: fetch team member
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                role: "editor",
              },
            ]),
          }),
        };
      });

      const access = await getSpaceAccess("user-invited", "space-2");
      expect(access).toBeDefined();
      expect(access?.role).toBe("editor");
      expect(access?.isDirectOwner).toBe(false);
      expect(access?.space.id).toBe("space-2");
    });

    it("returns null if user has no direct ownership or accepted membership", async () => {
      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Call 1: space found with owner-99
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  id: "space-3",
                  name: "Private Space",
                  ownerId: "owner-99",
                  embedKey: "emb_3",
                },
              ]),
            }),
          };
        }
        // Call 2: No membership found
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        };
      });

      const access = await getSpaceAccess("stranger-user", "space-3");
      expect(access).toBeNull();
    });
  });

  describe("verifySpaceAccess", () => {
    it("returns 404 when space does not exist", async () => {
      // getSpaceAccess returns null
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const res = await verifySpaceAccess("user-1", "non-existent-space", "viewer");
      expect(res.success).toBe(false);
      expect(res.errorResponse?.status).toBe(404);
    });

    it("returns 403 when user lacks required role (viewer attempting editor action)", async () => {
      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  id: "space-4",
                  name: "Client Space",
                  ownerId: "agency-owner",
                  embedKey: "emb_4",
                },
              ]),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                role: "viewer",
              },
            ]),
          }),
        };
      });

      const res = await verifySpaceAccess("user-viewer", "space-4", "editor");
      expect(res.success).toBe(false);
      expect(res.errorResponse?.status).toBe(403);
    });

    it("succeeds when user has required role", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              id: "space-5",
              name: "My Space",
              ownerId: "user-owner",
              embedKey: "emb_5",
            },
          ]),
        }),
      });

      const res = await verifySpaceAccess("user-owner", "space-5", "editor");
      expect(res.success).toBe(true);
      expect(res.access?.role).toBe("owner");
    });
  });
});
