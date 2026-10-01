import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as listInvites, POST as createInvite } from "../invites/route";
import { GET as verifyInvite } from "../invites/verify/route";
import { POST as acceptInvite } from "../invites/accept/route";
import { GET as listMembers } from "../members/route";
import { getSession } from "@/lib/auth/session";
import { canAccess } from "@/lib/auth/feature-gate";
import { db } from "@/lib/db";
import { sendTeamInviteEmail } from "@/lib/email/invite";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/auth/feature-gate", () => ({
  canAccess: vi.fn(),
}));

vi.mock("@/lib/email/invite", () => ({
  createInviteToken: vi.fn().mockReturnValue("mock-token-xyz"),
  sendTeamInviteEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("Team API Routes (Sprint 14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/team/invites", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);
      const res = await listInvites();
      expect(res.status).toBe(401);
    });

    it("returns pending invites for authenticated owner", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "owner-1", email: "owner@agency.com" },
      });

      const mockInvites = [
        {
          id: "inv-1",
          email: "colleague@agency.com",
          role: "editor",
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
        },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockInvites),
        }),
      });

      const res = await listInvites();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.invites).toHaveLength(1);
      expect(json.invites[0].email).toBe("colleague@agency.com");
    });
  });

  describe("POST /api/team/invites", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);
      const req = new Request("http://localhost/api/team/invites", {
        method: "POST",
        body: JSON.stringify({ email: "team@test.com", role: "editor" }),
      });
      const res = await createInvite(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 when user lacks multi-seat entitlement (non-Agency)", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-free", email: "free@test.com" },
      });
      (canAccess as any).mockResolvedValue(false);

      const req = new Request("http://localhost/api/team/invites", {
        method: "POST",
        body: JSON.stringify({ email: "team@test.com", role: "editor" }),
      });
      const res = await createInvite(req);
      expect(res.status).toBe(403);
    });

    it("creates invite and sends email when authorized", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "owner-agency", email: "boss@agency.com", name: "Agency Boss" },
      });
      (canAccess as any).mockResolvedValue(true);

      let selectCall = 0;
      (db.select as any).mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // Check if target user exists
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          };
        }
        // Check existing pending invite
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        };
      });

      const insertedInvite = {
        id: "inv-new",
        email: "designer@client.com",
        role: "viewer",
        token: "mock-token-xyz",
        expiresAt: new Date(Date.now() + 7 * 86400000),
      };

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([insertedInvite]),
        }),
      });

      const req = new Request("http://localhost/api/team/invites", {
        method: "POST",
        body: JSON.stringify({ email: "designer@client.com", role: "viewer" }),
      });

      const res = await createInvite(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.invite.email).toBe("designer@client.com");
      expect(sendTeamInviteEmail).toHaveBeenCalled();
    });
  });

  describe("GET /api/team/invites/verify", () => {
    it("returns 400 when token query param is missing", async () => {
      const req = new Request("http://localhost/api/team/invites/verify");
      const res = await verifyInvite(req);
      expect(res.status).toBe(400);
    });

    it("returns 404 when token is invalid or expired", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const req = new Request("http://localhost/api/team/invites/verify?token=bad-token");
      const res = await verifyInvite(req);
      expect(res.status).toBe(404);
    });

    it("returns invite details when token is valid", async () => {
      let selectCall = 0;
      (db.select as any).mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  id: "inv-valid",
                  email: "colleague@agency.com",
                  role: "editor",
                  teamOwnerId: "owner-1",
                  expiresAt: new Date(Date.now() + 86400000),
                },
              ]),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                name: "Owner Name",
                email: "owner@agency.com",
              },
            ]),
          }),
        };
      });

      const req = new Request("http://localhost/api/team/invites/verify?token=good-token");
      const res = await verifyInvite(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.invite.email).toBe("colleague@agency.com");
      expect(json.invite.role).toBe("editor");
    });
  });

  describe("POST /api/team/invites/accept", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);
      const req = new Request("http://localhost/api/team/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token: "some-token" }),
      });
      const res = await acceptInvite(req);
      expect(res.status).toBe(401);
    });

    it("accepts invitation and inserts team member record", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-joining", email: "colleague@agency.com" },
      });

      let selectCall = 0;
      (db.select as any).mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // Find valid invite
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  id: "inv-1",
                  token: "tok-123",
                  email: "colleague@agency.com",
                  role: "editor",
                  teamOwnerId: "owner-agency",
                  expiresAt: new Date(Date.now() + 86400000),
                },
              ]),
            }),
          };
        }
        // Check existing membership
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        };
      });

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "mem-1", role: "editor" }]),
        }),
      });

      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const req = new Request("http://localhost/api/team/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token: "tok-123" }),
      });

      const res = await acceptInvite(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.membership.role).toBe("editor");
    });
  });

  describe("GET /api/team/members", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);
      const res = await listMembers();
      expect(res.status).toBe(401);
    });

    it("returns owner and active team members", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "owner-1", email: "owner@agency.com" },
      });

      let selectCall = 0;
      (db.select as any).mockImplementation(() => {
        selectCall++;
        if (selectCall === 1) {
          // Owner record
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  id: "owner-1",
                  name: "Boss",
                  email: "owner@agency.com",
                  image: null,
                  createdAt: new Date(),
                },
              ]),
            }),
          };
        }
        // Accepted members
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                {
                  id: "mem-1",
                  userId: "user-2",
                  name: "Colleague",
                  email: "colleague@agency.com",
                  image: null,
                  role: "editor",
                  joinedAt: new Date(),
                },
              ]),
            }),
          }),
        };
      });

      const res = await listMembers();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.members).toHaveLength(2);
      expect(json.members[0].role).toBe("owner");
      expect(json.members[1].role).toBe("editor");
    });
  });
});
