import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as listExperiments, POST as createExperiment } from "../route";
import {
  GET as getExperiment,
  PATCH as updateExperiment,
  DELETE as deleteExperiment,
} from "../[expId]/route";
import { POST as applyWinner } from "../[expId]/apply-winner/route";
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

describe("Experiments API Routes", () => {
  const mockUser = { id: "user-123", email: "tester@vouchreel.com" };
  const mockSpace = { id: "space-456", ownerId: "user-123", name: "Test Space" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/spaces/[id]/experiments", () => {
    it("returns 401 if unauthenticated", async () => {
      (getSession as any).mockResolvedValue(null);

      const res = await listExperiments(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-456" }),
      });

      expect(res.status).toBe(401);
    });

    it("returns 404 if space is not found", async () => {
      (getSession as any).mockResolvedValue({ user: mockUser });
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const res = await listExperiments(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-missing" }),
      });

      expect(res.status).toBe(404);
    });

    it("returns 403 if user does not own space", async () => {
      (getSession as any).mockResolvedValue({ user: mockUser });
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "space-456", ownerId: "other-user" }]),
        }),
      });

      const res = await listExperiments(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-456" }),
      });

      expect(res.status).toBe(403);
    });

    it("lists experiments with per-variant metrics", async () => {
      (getSession as any).mockResolvedValue({ user: mockUser });

      const mockExp = {
        id: "exp-1",
        spaceId: "space-456",
        name: "Exit Intent vs Delay",
        type: "trigger",
        status: "running",
        variants: [
          { id: "v0", name: "Delay 5s", config: { type: "delay", value: { seconds: 5 } } },
          { id: "v1", name: "Exit Intent", config: { type: "exit-intent", value: {} } },
        ],
        trafficSplit: [50, 50],
        startedAt: new Date(),
        endedAt: null,
        createdAt: new Date(),
      };

      let selectCalls = 0;
      (db.select as any).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          // Space check
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([mockSpace]) }) };
        }
        if (selectCalls === 2) {
          // Experiments list query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([mockExp]),
              }),
            }),
          };
        }
        // Event metrics query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([
                { variantIndex: "0", impressions: 100, plays: 40, clicks: 10, conversions: 5 },
                { variantIndex: "1", impressions: 120, plays: 60, clicks: 25, conversions: 12 },
              ]),
            }),
          }),
        };
      });

      const res = await listExperiments(new Request("http://localhost"), {
        params: Promise.resolve({ id: "space-456" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.experiments).toHaveLength(1);
      expect(data.experiments[0].name).toBe("Exit Intent vs Delay");
      expect(data.experiments[0].variants).toHaveLength(2);
      expect(data.experiments[0].variants[0].impressions).toBe(100);
      expect(data.experiments[0].variants[1].conversions).toBe(12);
    });
  });

  describe("POST /api/spaces/[id]/experiments", () => {
    it("validates experiment input with zod (rejects traffic split not summing to 100)", async () => {
      (getSession as any).mockResolvedValue({ user: mockUser });
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockSpace]),
        }),
      });

      const res = await createExperiment(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            name: "Invalid Traffic",
            type: "position",
            variants: [
              { id: "v0", name: "Left", config: { position: "bottom-left" } },
              { id: "v1", name: "Right", config: { position: "bottom-right" } },
            ],
            trafficSplit: [40, 40], // sums to 80, not 100
          }),
        }),
        { params: Promise.resolve({ id: "space-456" }) }
      );

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    it("creates experiment in draft status when valid", async () => {
      (getSession as any).mockResolvedValue({ user: mockUser });
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockSpace]),
        }),
      });

      const created = {
        id: "exp-new-123",
        spaceId: "space-456",
        name: "Position Test",
        type: "position",
        variants: [
          { id: "v0", name: "Bottom Right", config: { position: "bottom-right" } },
          { id: "v1", name: "Bottom Left", config: { position: "bottom-left" } },
        ],
        trafficSplit: [50, 50],
        status: "draft",
      };

      (db.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([created]),
        }),
      });

      const res = await createExperiment(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            name: "Position Test",
            type: "position",
            variants: [
              { id: "v0", name: "Bottom Right", config: { position: "bottom-right" } },
              { id: "v1", name: "Bottom Left", config: { position: "bottom-left" } },
            ],
            trafficSplit: [50, 50],
          }),
        }),
        { params: Promise.resolve({ id: "space-456" }) }
      );

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.experiment.id).toBe("exp-new-123");
      expect(json.experiment.status).toBe("draft");
    });
  });

  describe("PATCH /api/spaces/[id]/experiments/[expId]", () => {
    it("updates status to running and sets startedAt", async () => {
      (getSession as any).mockResolvedValue({ user: mockUser });

      let selectCalls = 0;
      (db.select as any).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([mockSpace]) }) };
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              {
                id: "exp-1",
                spaceId: "space-456",
                status: "draft",
              },
            ]),
          }),
        };
      });

      const updated = {
        id: "exp-1",
        spaceId: "space-456",
        status: "running",
        startedAt: new Date(),
      };

      (db.update as any).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

      const res = await updateExperiment(
        new Request("http://localhost", {
          method: "PATCH",
          body: JSON.stringify({ status: "running" }),
        }),
        { params: Promise.resolve({ id: "space-456", expId: "exp-1" }) }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.experiment.status).toBe("running");
    });
  });

  describe("POST /api/spaces/[id]/experiments/[expId]/apply-winner", () => {
    it("updates widgetConfigs with winning variant override and marks experiment completed", async () => {
      (getSession as any).mockResolvedValue({ user: mockUser });

      const mockExperiment = {
        id: "exp-1",
        spaceId: "space-456",
        name: "Template Test",
        type: "template",
        status: "running",
        variants: [
          { id: "v0", name: "Floating Card", config: { template: "floating-card" } },
          { id: "v1", name: "Wall of Love", config: { template: "wall-of-love" } },
        ],
        trafficSplit: [50, 50],
      };

      const existingConfig = {
        id: "cfg-1",
        spaceId: "space-456",
        template: "floating-card",
      };

      let selectCalls = 0;
      (db.select as any).mockImplementation(() => {
        selectCalls++;
        if (selectCalls === 1) {
          // Space access check
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([mockSpace]) }) };
        }
        if (selectCalls === 2) {
          // Experiment lookup
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([mockExperiment]) }) };
        }
        // WidgetConfigs lookup
        return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([existingConfig]) }) };
      });

      let updateCalls = 0;
      (db.update as any).mockImplementation(() => {
        updateCalls++;
        if (updateCalls === 1) {
          // WidgetConfigs update
          return {
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{ ...existingConfig, template: "wall-of-love" }]),
              }),
            }),
          };
        }
        // Experiment completion update
        return {
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ ...mockExperiment, status: "completed", winnerVariantIndex: 1 }]),
            }),
          }),
        };
      });

      const res = await applyWinner(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({ variantIndex: 1 }),
        }),
        { params: Promise.resolve({ id: "space-456", expId: "exp-1" }) }
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.experiment.status).toBe("completed");
      expect(json.experiment.winnerVariantIndex).toBe(1);
      expect(json.widgetConfig.template).toBe("wall-of-love");
    });
  });
});
