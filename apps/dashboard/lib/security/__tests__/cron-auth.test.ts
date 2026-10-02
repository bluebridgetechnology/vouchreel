import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeCron } from "../cron-auth";

const req = (auth?: string) => new Request("http://localhost/api/cron/x", { headers: auth ? { authorization: auth } : {} });

afterEach(() => vi.unstubAllEnvs());

describe("authorizeCron", () => {
  it("fails closed in production when CRON_SECRET is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = authorizeCron(req());
    expect(res?.status).toBe(503);
  });

  it("stays open in development without a secret", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CRON_SECRET", "");
    expect(authorizeCron(req())).toBeNull();
  });

  it("requires the bearer secret when configured", () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(authorizeCron(req())?.status).toBe(401);
    expect(authorizeCron(req("Bearer wrong"))?.status).toBe(401);
    expect(authorizeCron(req("s3cret"))?.status).toBe(401);
    expect(authorizeCron(req("Bearer s3cret"))).toBeNull();
  });
});
