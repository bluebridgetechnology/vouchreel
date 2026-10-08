import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "../route";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DEFAULT_WIDGET_CONFIG } from "@/lib/validations/widget-config";

vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn() } }));

const params = { params: Promise.resolve({ id: "space-1" }) };
const put = (body: unknown) => PUT(new Request("http://localhost", { method: "PUT", body: JSON.stringify(body) }), params);

/** First select is the ownership check, the second the existing config. */
function mockSelects(owner: string, existing: unknown[] = []) {
  let n = 0;
  (db.select as any).mockImplementation(() => ({
    from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(n++ === 0 ? [{ ownerId: owner }] : existing) }),
  }));
}

describe("widget editor draft", () => {
  let set: ReturnType<typeof vi.fn>;
  let values: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    (getSession as any).mockResolvedValue({ user: { id: "user-1" } });
    set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    values = vi.fn().mockResolvedValue([]);
    (db.update as any).mockReturnValue({ set });
    (db.insert as any).mockReturnValue({ values });
  });

  it("only the space's owner may save or discard it", async () => {
    (getSession as any).mockResolvedValue(null);
    expect((await put(DEFAULT_WIDGET_CONFIG)).status).toBe(401);
    (getSession as any).mockResolvedValue({ user: { id: "user-1" } });
    mockSelects("someone-else");
    expect((await put(DEFAULT_WIDGET_CONFIG)).status).toBe(403);
    mockSelects("someone-else");
    expect((await DELETE(new Request("http://localhost"), params)).status).toBe(403);
    expect(set).not.toHaveBeenCalled();
  });

  it("rejects a draft that would not publish", async () => {
    mockSelects("user-1", [{ id: "cfg-1" }]);
    expect((await put({ ...DEFAULT_WIDGET_CONFIG, template: "hexagon" })).status).toBe(400);
    expect(set).not.toHaveBeenCalled();
  });

  it("saves into the draft column only, leaving the live config alone", async () => {
    mockSelects("user-1", [{ id: "cfg-1" }]);
    const draft = { ...DEFAULT_WIDGET_CONFIG, template: "carousel" };
    expect((await put(draft)).status).toBe(200);
    expect(Object.keys(set.mock.calls[0][0])).toEqual(["draftConfig"]);
    expect(set.mock.calls[0][0].draftConfig.template).toBe("carousel");
  });

  it("for a space with no config yet, the live one starts as the defaults", async () => {
    mockSelects("user-1", []);
    await put({ ...DEFAULT_WIDGET_CONFIG, template: "masonry" });
    expect(values.mock.calls[0][0]).toMatchObject({ spaceId: "space-1", template: DEFAULT_WIDGET_CONFIG.template, draftConfig: { template: "masonry" } });
  });

  it("discarding clears the draft", async () => {
    mockSelects("user-1");
    expect((await DELETE(new Request("http://localhost"), params)).status).toBe(200);
    expect(set.mock.calls[0][0]).toEqual({ draftConfig: null });
  });
});
