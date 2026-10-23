import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "../route";
import { NextResponse } from "next/server";

const allowed = { ok: true as const, session: { user: { id: "admin-1" } } };
const denied = { ok: false as const, response: NextResponse.json({ error: { code: "FORBIDDEN" } }, { status: 403 }) };
const guard = vi.fn();
vi.mock("@/lib/admin/guard", () => ({ requirePlatformAdminApi: () => guard() }));

const logAdminAction = vi.fn();
vi.mock("@/lib/admin/audit", () => ({
  logAdminAction: (e: unknown) => logAdminAction(e),
  diffFields: (before: Record<string, unknown>, after: Record<string, unknown>) =>
    Object.fromEntries(Object.keys(after).filter((k) => before[k] !== after[k]).map((k) => [k, { from: before[k], to: after[k] }])),
}));

const findFirst = vi.fn();
const insertValues = vi.fn();
const updateSet = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    query: { adminSettings: { findFirst: (...a: unknown[]) => findFirst(...a) } },
    insert: () => ({ values: (v: unknown) => Promise.resolve(insertValues(v)) }),
    update: () => ({ set: (v: unknown) => ({ where: () => Promise.resolve(updateSet(v)) }) }),
  },
}));

const put = (body: unknown) => PUT(new Request("http://x.test/api/admin/announcement", { method: "PUT", body: JSON.stringify(body) }));
const valid = { enabled: true, message: "Now in beta", linkText: "Join the beta", linkUrl: "/signup" };

beforeEach(() => {
  guard.mockReset().mockResolvedValue(allowed);
  findFirst.mockReset().mockResolvedValue(undefined);
  insertValues.mockReset();
  updateSet.mockReset();
  logAdminAction.mockReset();
});

describe("/api/admin/announcement", () => {
  it("is for platform admins only", async () => {
    guard.mockResolvedValue(denied);
    expect((await GET()).status).toBe(403);
    expect((await put(valid)).status).toBe(403);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("returns an empty, switched-off announcement when none is saved", async () => {
    const body = await (await GET()).json();
    expect(body.announcement).toEqual({ enabled: false, message: "", linkText: "", linkUrl: "" });
  });

  it("creates the setting the first time and records who changed it", async () => {
    const res = await put(valid);
    expect(res.status).toBe(200);
    expect(insertValues).toHaveBeenCalledWith({ key: "announcement", value: valid });
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin-1", action: "settings.announcement", entityId: "announcement" }));
  });

  it("updates the setting when one exists", async () => {
    findFirst.mockResolvedValue({ key: "announcement", value: { enabled: false, message: "", linkText: "", linkUrl: "" } });
    expect((await put(valid)).status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith({ value: valid });
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("refuses an unsafe link without saving anything", async () => {
    const res = await put({ ...valid, linkUrl: "javascript:alert(1)" });
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("refuses to switch on an empty message", async () => {
    expect((await put({ ...valid, message: "" })).status).toBe(400);
  });
});
