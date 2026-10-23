import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { GET, POST } from "../route";
import { DELETE, PUT } from "../[id]/route";

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

const getPostForAdmin = vi.fn();
const listPostsForAdmin = vi.fn();
vi.mock("@/lib/blog", () => ({
  getPostForAdmin: (...a: unknown[]) => getPostForAdmin(...a),
  listPostsForAdmin: () => listPostsForAdmin(),
  // The real check looks for Postgres's duplicate-key code, which is all the tests raise
  isDuplicateSlugError: (err: unknown) => (err as { code?: string })?.code === "23505",
}));

const insertValues = vi.fn();
const updateSet = vi.fn();
const deleteReturning = vi.fn();
vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({ values: (v: unknown) => ({ returning: () => Promise.resolve([insertValues(v)]).then((r) => (r[0] instanceof Error ? Promise.reject(r[0]) : r)) }) }),
    update: () => ({ set: (v: unknown) => ({ where: () => ({ returning: () => Promise.resolve([updateSet(v)]) }) }) }),
    delete: () => ({ where: () => ({ returning: () => Promise.resolve(deleteReturning()) }) }),
  },
}));

const ID = "0b1b3b62-6f64-4d6c-9a52-0b2f2f0f6a11";
const body = { title: "A first post", slug: "a-first-post", excerpt: "", content: "Some words", coverImageUrl: "", authorName: "", isPublished: false, publishedAt: null };
const req = (payload: unknown, method = "POST") => new Request("http://x.test/api/admin/blog", { method, body: JSON.stringify(payload) });
const params = (id = ID) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  guard.mockReset().mockResolvedValue(allowed);
  insertValues.mockReset().mockImplementation((v: Record<string, unknown>) => ({ id: ID, ...v }));
  updateSet.mockReset().mockImplementation((v: Record<string, unknown>) => ({ id: ID, title: "A first post", content: "Some words", ...v }));
  deleteReturning.mockReset().mockReturnValue([{ id: ID, title: "A first post" }]);
  getPostForAdmin.mockReset().mockResolvedValue({ id: ID, title: "A first post", slug: "a-first-post", content: "Old", isPublished: false, publishedAt: null });
  listPostsForAdmin.mockReset().mockResolvedValue([]);
  logAdminAction.mockReset();
});

describe("/api/admin/blog", () => {
  it("is for platform admins only", async () => {
    guard.mockResolvedValue(denied);
    expect((await GET()).status).toBe(403);
    expect((await POST(req(body))).status).toBe(403);
    expect((await PUT(req(body, "PUT"), params())).status).toBe(403);
    expect((await DELETE(req({}, "DELETE"), params())).status).toBe(403);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("creates a draft with no date, and records who did it", async () => {
    const res = await POST(req(body));
    expect(res.status).toBe(201);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ slug: "a-first-post", isPublished: false, publishedAt: null }));
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin-1", action: "blog.created", entityType: "blog_post" }));
  });

  it("gives a published post with no date the time it was published", async () => {
    await POST(req({ ...body, isPublished: true }));
    const saved = insertValues.mock.calls[0][0] as { publishedAt: Date };
    expect(saved.publishedAt).toBeInstanceOf(Date);
  });

  it("keeps a chosen date, so a post can be scheduled", async () => {
    await POST(req({ ...body, isPublished: true, publishedAt: "2030-01-01T10:00:00.000Z" }));
    expect((insertValues.mock.calls[0][0] as { publishedAt: Date }).publishedAt).toEqual(new Date("2030-01-01T10:00:00.000Z"));
  });

  it("refuses a bad web address without saving", async () => {
    const res = await POST(req({ ...body, slug: "Not A Slug" }));
    expect(res.status).toBe(400);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it("says so when the web address is taken", async () => {
    insertValues.mockImplementation(() => Object.assign(new Error("duplicate key"), { code: "23505" }));
    const res = await POST(req(body));
    expect(res.status).toBe(409);
  });

  it("keeps the original date when a live post is saved again", async () => {
    const original = new Date("2026-05-01T08:00:00.000Z");
    getPostForAdmin.mockResolvedValue({ id: ID, title: "A first post", slug: "a-first-post", content: "Old", isPublished: true, publishedAt: original });
    const res = await PUT(req({ ...body, isPublished: true }, "PUT"), params());
    expect(res.status).toBe(200);
    expect((updateSet.mock.calls[0][0] as { publishedAt: Date }).publishedAt).toEqual(original);
  });

  it("answers not found for an unknown or malformed id", async () => {
    getPostForAdmin.mockResolvedValue(null);
    expect((await PUT(req(body, "PUT"), params())).status).toBe(404);
    expect((await PUT(req(body, "PUT"), params("not-a-uuid"))).status).toBe(404);
  });

  it("deletes a post and records it", async () => {
    const res = await DELETE(req({}, "DELETE"), params());
    expect(res.status).toBe(200);
    expect(logAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "blog.deleted" }));
  });

  it("answers not found when there is nothing to delete", async () => {
    deleteReturning.mockReturnValue([]);
    expect((await DELETE(req({}, "DELETE"), params())).status).toBe(404);
  });
});
