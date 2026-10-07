import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const run = vi.fn();
vi.mock("@/lib/admin/worker-alerts", () => ({ runWorkerAlerts: () => run() }));

describe("GET /api/cron/check-workers", () => {
  beforeEach(() => {
    run.mockReset();
    process.env.CRON_SECRET = "cron-secret-for-tests";
  });

  it("refuses a caller without the cron secret and runs nothing", async () => {
    expect((await GET(new Request("http://x"))).status).toBe(401);
    expect((await GET(new Request("http://x", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });

  it("runs the check for the cron and reports what it sent", async () => {
    run.mockResolvedValue({ checked: 2, sent: [] });
    const res = await GET(new Request("http://x", { headers: { authorization: "Bearer cron-secret-for-tests" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, checked: 2, sent: [] });
  });

  it("a failing check is a 500, not an unhandled error", async () => {
    run.mockRejectedValue(new Error("db down"));
    const res = await GET(new Request("http://x", { headers: { authorization: "Bearer cron-secret-for-tests" } }));
    expect(res.status).toBe(500);
  });
});
