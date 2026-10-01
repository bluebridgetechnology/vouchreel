import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as triggerExport } from "../route";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import * as pipelineModule from "@/lib/social/pipeline";

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/lib/social/pipeline", () => ({
  queueSocialExport: vi.fn(),
}));

describe("Social Export Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (getSession as any).mockResolvedValue(null);

    const res = await triggerExport(new Request("http://localhost"), {
      params: Promise.resolve({ id: "space-1", tid: "test-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when testimonial has no video file", async () => {
    (getSession as any).mockResolvedValue({
      user: { id: "user-1", email: "user@test.com" },
    });

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
          where: vi.fn().mockResolvedValue([
            { id: "test-1", spaceId: "space-1", videoUrl: null, clipUrl: null },
          ]),
        }),
      });

    const res = await triggerExport(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "tiktok" }),
      }),
      { params: Promise.resolve({ id: "space-1", tid: "test-1" }) }
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("no video file");
  });

  it("successfully creates social export and queues background rendering", async () => {
    (getSession as any).mockResolvedValue({
      user: { id: "user-1", email: "user@test.com" },
    });

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
          where: vi.fn().mockResolvedValue([
            {
              id: "test-1",
              spaceId: "space-1",
              videoUrl: "https://example.com/video.mp4",
            },
          ]),
        }),
      });

    const createdRecord = {
      id: "export-123",
      spaceId: "space-1",
      testimonialId: "test-1",
      format: "tiktok",
      status: "pending",
    };

    const insertMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([createdRecord]),
    });
    (db.insert as any).mockReturnValue({ values: insertMock });

    const res = await triggerExport(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "tiktok", framing: "blur" }),
      }),
      { params: Promise.resolve({ id: "space-1", tid: "test-1" }) }
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.export.id).toBe("export-123");
    expect(pipelineModule.queueSocialExport).toHaveBeenCalledWith("export-123");
  });
});
