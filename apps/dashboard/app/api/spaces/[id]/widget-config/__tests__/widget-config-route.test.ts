import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getWidgetConfig, PUT as updateWidgetConfig } from "../route";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DEFAULT_WIDGET_CONFIG } from "@/lib/validations/widget-config";

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

describe("Widget Config API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/spaces/[id]/widget-config", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const res = await getWidgetConfig(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 404 when space does not exist", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const res = await getWidgetConfig(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-nonexistent" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 403 when user does not own space", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "space-other", ownerId: "user-2", name: "Other Space" },
          ]),
        }),
      });

      const res = await getWidgetConfig(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-other" }),
      });

      expect(res.status).toBe(403);
    });

    it("returns existing widget config for owner", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      const mockSpace = {
        id: "space-1",
        ownerId: "user-1",
        name: "My Space",
        embedKey: "emb_123",
      };

      const mockConfig = {
        id: "cfg-1",
        spaceId: "space-1",
        position: "bottom-left",
        theme: {
          primaryColor: "#ff0000",
          accentColor: "#ffffff",
          mode: "dark",
          borderRadius: 8,
        },
        triggerType: "exit-intent",
        triggerValue: {},
        pagesIncluded: ["/products/*"],
        pagesExcluded: ["/cart"],
        autoplayPreview: false,
        createdAt: new Date(),
      };

      let selectCalls = 0;
      (db.select as any).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          // Space query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([mockSpace]),
            }),
          };
        }
        // Widget config query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([mockConfig]),
          }),
        };
      });

      const res = await getWidgetConfig(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.widgetConfig.position).toBe("bottom-left");
      expect(json.widgetConfig.theme.primaryColor).toBe("#ff0000");
      expect(json.space.embedKey).toBe("emb_123");
    });

    it("creates default widget config if none exists", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      const mockSpace = {
        id: "space-1",
        ownerId: "user-1",
        name: "My Space",
        embedKey: "emb_abc",
      };

      let selectCalls = 0;
      (db.select as any).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([mockSpace]),
            }),
          };
        }
        // No existing widget config
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        };
      });

      const insertedDefault = {
        id: "cfg-new",
        spaceId: "space-1",
        ...DEFAULT_WIDGET_CONFIG,
        createdAt: new Date(),
      };

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([insertedDefault]),
        }),
      });

      const res = await getWidgetConfig(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.widgetConfig.position).toBe("bottom-right");
      expect(json.widgetConfig.theme.primaryColor).toBe("#6366f1");
      expect(json.widgetConfig.triggerType).toBe("delay");
      expect(json.widgetConfig.autoplayPreview).toBe(true);
      expect(json.space.embedKey).toBe("emb_abc");
    });
  });

  describe("PUT /api/spaces/[id]/widget-config", () => {
    it("returns 401 when unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify(DEFAULT_WIDGET_CONFIG),
      });

      const res = await updateWidgetConfig(req, {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 403 when updating config for another user's space", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "space-2", ownerId: "user-2", name: "User 2 Space" },
          ]),
        }),
      });

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify(DEFAULT_WIDGET_CONFIG),
      });

      const res = await updateWidgetConfig(req, {
        params: Promise.resolve({ id: "space-2" }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 400 when validation fails", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { id: "space-1", ownerId: "user-1", name: "My Space" },
          ]),
        }),
      });

      const invalidPayload = {
        ...DEFAULT_WIDGET_CONFIG,
        position: "invalid-position",
        theme: {
          ...DEFAULT_WIDGET_CONFIG.theme,
          primaryColor: "not-a-hex",
        },
      };

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify(invalidPayload),
      });

      const res = await updateWidgetConfig(req, {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Validation failed");
      expect(json.details).toBeDefined();
    });

    it("updates widget config successfully for owner", async () => {
      (getSession as any).mockResolvedValue({
        user: { id: "user-1", email: "user@test.com" },
      });

      const mockSpace = {
        id: "space-1",
        ownerId: "user-1",
        name: "My Space",
        embedKey: "emb_123",
      };

      let selectCalls = 0;
      (db.select as any).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([mockSpace]),
            }),
          };
        }
        // Existing config exists
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: "cfg-1", spaceId: "space-1" }]),
          }),
        };
      });

      const updatedData = {
        ...DEFAULT_WIDGET_CONFIG,
        position: "story-strip" as const,
        theme: {
          primaryColor: "#10b981",
          accentColor: "#ffffff",
          mode: "dark" as const,
          borderRadius: 20,
        },
        triggerType: "scroll-depth" as const,
        triggerValue: { percentage: 60 },
      };

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              { id: "cfg-1", spaceId: "space-1", ...updatedData },
            ]),
          }),
        }),
      });

      const req = new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify(updatedData),
      });

      const res = await updateWidgetConfig(req, {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.widgetConfig.position).toBe("story-strip");
      expect(json.widgetConfig.theme.primaryColor).toBe("#10b981");
      expect(json.widgetConfig.triggerType).toBe("scroll-depth");
    });
  });
});
