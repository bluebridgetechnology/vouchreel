import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

vi.mock("@/lib/db", () => ({ db: {} }));
const collect = vi.fn();
vi.mock("@/lib/observability/metrics", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/observability/metrics")>()), collectMetrics: () => collect() }));
vi.spyOn(console, "error").mockImplementation(() => {});

const call = (auth?: string) => GET(new Request("http://x/api/metrics", { headers: auth ? { authorization: auth } : {} }));

describe("GET /api/metrics", () => {
  beforeEach(() => {
    collect.mockReset();
    process.env.METRICS_TOKEN = "metrics-token-for-tests";
  });

  it("does not exist unless a token is configured", async () => {
    delete process.env.METRICS_TOKEN;
    expect((await call("Bearer anything")).status).toBe(404);
    expect(collect).not.toHaveBeenCalled();
  });

  it("refuses a missing or wrong token without collecting anything", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer nope")).status).toBe(401);
    expect((await call("metrics-token-for-tests")).status).toBe(401);
    expect(collect).not.toHaveBeenCalled();
  });

  it("returns Prometheus text for the right token", async () => {
    collect.mockResolvedValue([{ name: "vouchreel_up", help: "up", type: "gauge", samples: [{ value: 1 }] }]);
    const res = await call("Bearer metrics-token-for-tests");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toContain("vouchreel_up 1");
  });

  it("reports the target as down, not as an unhandled error, when collecting fails", async () => {
    collect.mockRejectedValue(new Error("db down"));
    const res = await call("Bearer metrics-token-for-tests");
    expect(res.status).toBe(500);
    expect(await res.text()).toContain("vouchreel_up 0");
  });
});
