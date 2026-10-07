import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { PUT } from "../[reviewId]/route";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { resetRateLimits } from "@/lib/rate-limit";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }));

const space = { id: "space-abc", ownerId: "user-123" };
const body = { name: "Priya N.", text: "They fixed our books in a week and were lovely." };

/** select().from().where() resolves to each given result in turn */
function selects(...results: unknown[][]) {
  const fn = vi.fn();
  for (const r of results) fn.mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve(r) }) });
  (db.select as any).mockImplementation(fn);
}
const post = (b: unknown) =>
  POST(new Request("http://x/api/spaces/space-abc/reviews/own", { method: "POST", body: JSON.stringify(b) }), { params: Promise.resolve({ id: "space-abc" }) });

describe("owner-supplied reviews API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
    (getSession as any).mockResolvedValue({ user: { id: "user-123" } });
  });

  it("needs a signed-in owner of the space", async () => {
    (getSession as any).mockResolvedValue(null);
    expect((await post(body)).status).toBe(401);
    (getSession as any).mockResolvedValue({ user: { id: "someone-else" } });
    selects([space]);
    expect((await post(body)).status).toBe(403);
    selects([]);
    expect((await post(body)).status).toBe(404);
  });

  it("rejects invalid input with the field errors", async () => {
    selects([space]);
    const res = await post({ name: "", text: "short", link: "http://insecure.example" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(Object.keys(json.error.details).sort()).toEqual(["link", "name", "text"]);
  });

  it("stops at the per-space limit", async () => {
    selects([space], [{ n: 200 }]);
    expect((await post(body)).status).toBe(400);
  });

  it("stores the review with no provider rating or date", async () => {
    selects([space], [{ n: 3 }]);
    const values = vi.fn().mockReturnValue({ returning: () => Promise.resolve([{ id: "r1" }]) });
    (db.insert as any).mockReturnValue({ values });
    const res = await post({ ...body, link: "https://example.com/reviews" });
    expect(res.status).toBe(201);
    expect(values.mock.calls[0][0]).toMatchObject({
      spaceId: "space-abc",
      provider: "own",
      sourceId: null,
      rating: null,
      reviewDate: null,
      authorName: "Priya N.",
      linkUrl: "https://example.com/reviews",
      isApproved: true,
    });
    expect(values.mock.calls[0][0].providerReviewId).toMatch(/^own:/);
  });

  it("edits only reviews of the own kind in this space", async () => {
    selects([space]);
    const where = vi.fn().mockReturnValue({ returning: () => Promise.resolve([]) });
    (db.update as any).mockReturnValue({ set: () => ({ where }) });
    const res = await PUT(new Request("http://x", { method: "PUT", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "space-abc", reviewId: "google-review" }) });
    expect(res.status).toBe(404); // an imported review matches nothing, so it cannot be edited
    expect(where).toHaveBeenCalled();
  });
});
