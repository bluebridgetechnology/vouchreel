import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { resetRateLimits } from "@/lib/rate-limit";

let form: { id: string; collectModes: string } | undefined = { id: "11111111-2222-3333-4444-555555555555", collectModes: "both" };
const createPresignedUpload = vi.fn(async (key: string) => ({ url: "https://bucket.test", fields: { key, "Content-Type": "video/mp4" }, key, expiresInSeconds: 900 }));
let storage: Record<string, unknown> = { createPresignedUpload };

vi.mock("@/lib/db", () => ({ db: { select: () => ({ from: () => ({ where: () => Promise.resolve(form ? [form] : []) }) }) } }));
vi.mock("@/lib/storage", () => ({ getStorage: () => storage }));

const ctx = { params: Promise.resolve({ slug: "acme" }) };
const call = (body: unknown) => POST(new Request("http://x/api/collect/acme/uploads", { method: "POST", body: JSON.stringify(body) }), ctx);

describe("POST /api/collect/[slug]/uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
    form = { id: "11111111-2222-3333-4444-555555555555", collectModes: "both" };
    storage = { createPresignedUpload };
  });

  it("hands out a presigned upload for a key under the form, with the size limit and the base type", async () => {
    const res = await call({ contentType: "video/webm;codecs=vp9,opus", size: 5_000_000 });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.direct).toBe(true);
    expect(json.key).toMatch(/^uploads\/pending\/11111111-2222-3333-4444-555555555555\/[0-9a-f-]{36}\.webm$/);
    expect(createPresignedUpload).toHaveBeenCalledWith(json.key, { contentType: "video/webm", maxBytes: 100 * 1024 * 1024 });
  });

  it("says direct: false when the storage cannot do it, so the form uploads through the server", async () => {
    storage = {};
    expect(await (await call({ contentType: "video/mp4", size: 1000 })).json()).toEqual({ direct: false });
  });

  it("refuses a type that is not a video, a file over 100 MB, and nonsense", async () => {
    expect((await call({ contentType: "application/x-msdownload", size: 1000 })).status).toBe(400);
    expect((await call({ contentType: "video/mp4", size: 100 * 1024 * 1024 + 1 })).status).toBe(400);
    expect((await call({ contentType: "video/mp4", size: -3 })).status).toBe(400);
    expect((await call({})).status).toBe(400);
    expect(createPresignedUpload).not.toHaveBeenCalled();
  });

  it("refuses an unknown form and a form that only takes written testimonials", async () => {
    form = undefined;
    expect((await call({ contentType: "video/mp4", size: 1000 })).status).toBe(404);
    form = { id: "11111111-2222-3333-4444-555555555555", collectModes: "text" };
    expect((await call({ contentType: "video/mp4", size: 1000 })).status).toBe(400);
  });

  it("limits how many uploads one address can start", async () => {
    for (let i = 0; i < 20; i++) expect((await call({ contentType: "video/mp4", size: 1000 })).status).toBe(200);
    expect((await call({ contentType: "video/mp4", size: 1000 })).status).toBe(429);
  });
});
