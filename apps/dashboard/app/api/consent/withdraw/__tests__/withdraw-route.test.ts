import { beforeEach, describe, expect, it, vi } from "vitest";

const withdraw = vi.fn();
vi.mock("@/lib/ai-video/consent-withdrawal", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai-video/consent-withdrawal")>("@/lib/ai-video/consent-withdrawal");
  return { ...actual, withdrawConsent: (...a: unknown[]) => withdraw(...a) };
});
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/storage", () => ({ getStorage: vi.fn() }));
vi.mock("@/lib/storage/cleanup", () => ({ keysFromUrls: vi.fn(), queueFileCleanup: vi.fn() }));
vi.mock("@/lib/notifications/service", () => ({ notifySpaceOwner: vi.fn() }));
vi.mock("@/lib/email/transport", () => ({ sendEmail: vi.fn() }));

import { POST } from "../route";
import { consentToken } from "@/lib/ai-video/consent-withdrawal";
import { resetRateLimits } from "@/lib/rate-limit";

const ID = "0b9a1f0e-3c1d-4b0b-9f7e-2f6d4c1a8e55";
const post = (body: unknown, ip = "203.0.113.5") =>
  POST(new Request("http://x/api/consent/withdraw", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": ip } }));

describe("POST /api/consent/withdraw", () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = "a-test-secret-of-sufficient-length-0123456789";
    withdraw.mockReset();
    resetRateLimits();
  });

  it("withdraws with a valid link token, as the customer", async () => {
    withdraw.mockResolvedValue({ status: "withdrawn", removedVideos: 2, stoppedVideos: 0 });
    const res = await post({ token: consentToken(ID) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "withdrawn", removedVideos: 2 });
    expect(withdraw).toHaveBeenCalledWith(ID, "customer");
  });

  it("repeating it succeeds and says it was already done", async () => {
    withdraw.mockResolvedValue({ status: "already_withdrawn", removedVideos: 0, stoppedVideos: 0 });
    const res = await post({ token: consentToken(ID) });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("already_withdrawn");
  });

  it("refuses a forged, edited or missing token without touching anything", async () => {
    expect((await post({ token: `${ID}.${"0".repeat(64)}` })).status).toBe(400);
    expect((await post({ token: "not-a-token-at-all" })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post(null)).status).toBe(400);
    expect(withdraw).not.toHaveBeenCalled();
  });

  it("reports a consent that no longer exists, and a failure as a 500", async () => {
    withdraw.mockResolvedValueOnce({ status: "not_found", removedVideos: 0, stoppedVideos: 0 });
    expect((await post({ token: consentToken(ID) })).status).toBe(404);
    withdraw.mockRejectedValueOnce(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post({ token: consentToken(ID) })).status).toBe(500);
    err.mockRestore();
  });

  it("limits how often one address can try", async () => {
    withdraw.mockResolvedValue({ status: "withdrawn", removedVideos: 0, stoppedVideos: 0 });
    for (let i = 0; i < 20; i++) expect((await post({ token: consentToken(ID) }, "198.51.100.9")).status).toBe(200);
    expect((await post({ token: consentToken(ID) }, "198.51.100.9")).status).toBe(429);
    expect((await post({ token: consentToken(ID) }, "198.51.100.10")).status).toBe(200); // someone else is unaffected
  });
});
