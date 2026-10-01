import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as listSpaces, POST as createSpace } from "../route";
import {
  GET as getSpace,
  PUT as updateSpace,
  DELETE as deleteSpace,
} from "../[id]/route";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

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

describe("Spaces API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/spaces", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const res = await listSpaces();
      expect(res.status).toBe(401);
    });

    it("lists user spaces with testimonial counts", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      const mockSpaces = [
        {
          id: "space-1",
          name: "Main App",
          ownerId: "user-1",
          embedKey: "emb_123",
          createdAt: new Date(),
        },
      ];

      // Setup select chains for spaces and testimonial count
      let callCount = 0;
      (db.select as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockSpaces),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ value: 3 }]),
          }),
        };
      });

      const res = await listSpaces();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.spaces).toHaveLength(1);
      expect(json.spaces[0].name).toBe("Main App");
      expect(json.spaces[0].testimonialCount).toBe(3);
    });
  });

  describe("POST /api/spaces", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const req = new Request("http://localhost/api/spaces", {
        method: "POST",
        body: JSON.stringify({ name: "New Space" }),
      });

      const res = await createSpace(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 when space name is empty", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      const req = new Request("http://localhost/api/spaces", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      });

      const res = await createSpace(req);
      expect(res.status).toBe(400);
    });

    it("creates a space with unique embedKey and widget config", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      const createdSpace = {
        id: "space-new",
        name: "Acme Landing",
        ownerId: "user-1",
        embedKey: "abc123xyz890",
        createdAt: new Date(),
      };

      let insertCount = 0;
      (db.insert as any).mockImplementation(() => {
        insertCount++;
        if (insertCount === 1) {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([createdSpace]),
            }),
          };
        }
        return {
          values: vi.fn().mockResolvedValue(undefined),
        };
      });

      const req = new Request("http://localhost/api/spaces", {
        method: "POST",
        body: JSON.stringify({ name: "Acme Landing" }),
      });

      const res = await createSpace(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.space.name).toBe("Acme Landing");
      expect(json.space.embedKey).toBeDefined();
    });
  });

  describe("GET /api/spaces/[id]", () => {
    it("returns 404 if space does not exist", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const res = await getSpace(new Request("http://localhost"), {
        params: Promise.resolve({ id: "non-existent" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 403 if space is owned by someone else", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "space-other", name: "Other Space", ownerId: "user-2" },
          ]),
        }),
      });

      const res = await getSpace(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-other" }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 200 with space details for the owner", async () => {
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
                { id: "space-1", name: "My Space", ownerId: "user-1" },
              ]),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ value: 5 }]),
          }),
        };
      });

      const res = await getSpace(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.space.name).toBe("My Space");
      expect(json.space.testimonialCount).toBe(5);
    });
  });

  describe("PUT /api/spaces/[id]", () => {
    it("returns 403 when updating another user's space", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "space-other", name: "Other", ownerId: "user-2" },
          ]),
        }),
      });

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ name: "Hacked" }),
      });

      const res = await updateSpace(req, {
        params: Promise.resolve({ id: "space-other" }),
      });

      expect(res.status).toBe(403);
    });

    it("renames space for owner", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "space-1", name: "Old Name", ownerId: "user-1" },
          ]),
        }),
      });

      const updated = { id: "space-1", name: "Renamed Space", ownerId: "user-1" };
      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ name: "Renamed Space" }),
      });

      const res = await updateSpace(req, {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.space.name).toBe("Renamed Space");
    });
  });

  describe("DELETE /api/spaces/[id]", () => {
    it("returns 403 when deleting another user's space", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "space-2", name: "User 2 Space", ownerId: "user-2" },
          ]),
        }),
      });

      const res = await deleteSpace(new Request("http://localhost", { method: "DELETE" }), {
        params: Promise.resolve({ id: "space-2" }),
      });

      expect(res.status).toBe(403);
    });

    it("deletes space successfully for owner", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "space-1", name: "My Space", ownerId: "user-1" },
          ]),
        }),
      });

      (db.delete as any).mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const res = await deleteSpace(new Request("http://localhost", { method: "DELETE" }), {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });
});
