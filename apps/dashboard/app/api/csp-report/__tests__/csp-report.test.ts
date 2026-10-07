import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";
import { resetRateLimits } from "@/lib/rate-limit";
import { log } from "@/lib/log";

vi.mock("@/lib/log", () => ({ log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

const send = (body: unknown, type = "application/csp-report") =>
  POST(new Request("http://x/api/csp-report", { method: "POST", headers: { "content-type": type }, body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("POST /api/csp-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRateLimits();
  });

  it("logs a legacy report with the query string removed from every address", async () => {
    const res = await send({
      "csp-report": {
        "document-uri": "https://app.example.com/reset-password?token=SECRET123&email=a@b.com",
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://evil.example/x.js?key=abc",
        "source-file": "https://app.example.com/_next/static/a.js?v=1",
        "line-number": 12,
        disposition: "report",
      },
    });
    expect(res.status).toBe(204);
    expect(log.warn).toHaveBeenCalledTimes(1);
    const fields = (log.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1] as Record<string, unknown>;
    expect(fields).toMatchObject({ directive: "script-src-elem", line: 12, disposition: "report" });
    expect(JSON.stringify(fields)).not.toContain("SECRET123");
    expect(JSON.stringify(fields)).not.toContain("a@b.com");
    expect(JSON.stringify(fields)).not.toContain("key=abc");
  });

  it("keeps keywords such as inline and eval as they are", async () => {
    await send({ "csp-report": { "effective-directive": "script-src-elem", "blocked-uri": "inline", "document-uri": "https://app.example.com/login" } });
    expect((log.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1]).toMatchObject({ blocked: "inline" });
  });

  it("reads the Reporting API format too", async () => {
    await send([{ type: "csp-violation", body: { effectiveDirective: "img-src", blockedURL: "https://cdn.example/i.png", documentURL: "https://app.example.com/" } }], "application/reports+json");
    expect((log.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][1]).toMatchObject({ directive: "img-src", blocked: "https://cdn.example/i.png" });
  });

  it("answers 204 and logs nothing for junk, oversized bodies and the wrong shape", async () => {
    expect((await send("not json")).status).toBe(204);
    expect((await send({ hello: "world" })).status).toBe(204);
    expect((await send("x".repeat(20_000))).status).toBe(204);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("stops logging after 60 reports a minute from one address, still answering 204", async () => {
    for (let i = 0; i < 60; i++) await send({ "csp-report": { "effective-directive": "img-src" } });
    expect((await send({ "csp-report": { "effective-directive": "img-src" } })).status).toBe(204);
    expect(log.warn).toHaveBeenCalledTimes(60);
  });
});
