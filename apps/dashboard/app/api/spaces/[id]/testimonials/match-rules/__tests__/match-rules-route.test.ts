import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT } from "../route";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";
const rules = { mode: "specific", urlPatterns: ["/pricing"], tags: [] };

const put = (body: unknown) =>
  PUT(
    new Request("http://localhost/api/spaces/space-1/testimonials/match-rules", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "space-1" }) }
  );

const ownSpace = (ownerId = "user-1") =>
  (db.select as any).mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: "space-1", ownerId }]) }) });

describe("PUT /api/spaces/[id]/testimonials/match-rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getSession as any).mockResolvedValue({ user: { id: "user-1" } });
  });

  it("needs a signed-in owner", async () => {
    (getSession as any).mockResolvedValue(null);
    expect((await put({ ids: [ID_A], matchRules: rules })).status).toBe(401);

    (getSession as any).mockResolvedValue({ user: { id: "user-1" } });
    ownSpace("someone-else");
    expect((await put({ ids: [ID_A], matchRules: rules })).status).toBe(403);
  });

  it("sets the rules on every picked testimonial and reports which changed", async () => {
    ownSpace();
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: ID_A }, { id: ID_B }]) }) });
    (db.update as any).mockReturnValue({ set });

    const res = await put({ ids: [ID_A, ID_B], matchRules: rules });

    expect(res.status).toBe(200);
    expect(set).toHaveBeenCalledWith({ matchRules: rules });
    expect((await res.json()).updated).toEqual([ID_A, ID_B]);
  });

  it("rejects an empty selection and ids that are not uuids", async () => {
    ownSpace();
    expect((await put({ ids: [], matchRules: rules })).status).toBe(400);
    expect((await put({ ids: ["nope"], matchRules: rules })).status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });
});
