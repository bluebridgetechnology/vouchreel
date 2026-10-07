import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureRequestError, flushObservability, initObservability, resetObservabilityForTests } from "../sentry";
import { log } from "@/lib/log";

vi.spyOn(console, "error").mockImplementation(() => {});

const sent: Record<string, any>[] = [];
const transport = () => ({
  send: async (envelope: unknown) => {
    const items = (envelope as [unknown, [unknown, Record<string, unknown>][]])[1];
    for (const [, payload] of items) sent.push(payload);
    return {};
  },
  flush: async () => true,
});

beforeEach(() => {
  sent.length = 0;
  delete process.env.SENTRY_DSN;
});
afterEach(async () => {
  await resetObservabilityForTests();
});

describe("error tracking", () => {
  it("is off without a DSN: reports false, and errors go nowhere", async () => {
    expect(initObservability("web")).toBe(false);
    log.error("nobody listens", new Error("x"));
    captureRequestError(new Error("x"), { path: "/a", method: "GET" }, {});
    await flushObservability();
    expect(sent).toEqual([]);
  });

  it("with a DSN, log.error reaches the tracker scrubbed, tagged with the service, with no personal data", async () => {
    expect(initObservability("worker", { dsn: "https://key@example.test/1", transport })).toBe(true);
    // Built at run time, so the words are not also sitting in this file's source lines that the stack trace carries
    const words = ["pri", "vate", " words"].join("");
    log.error("job failed for ada@example.com", new Error("boom for ada@example.com token=abc123"), { jobId: "j1", quote: words });
    await flushObservability();
    const event = sent.find((e) => e.exception);
    expect(event).toBeDefined();
    expect(event!.tags).toMatchObject({ service: "worker" });
    const text = JSON.stringify(event);
    expect(text).toContain("boom for [email] token=[redacted]");
    expect(text.match(/ada@example|abc123|private words/)).toBeNull();
    expect(event!.extra).toMatchObject({ jobId: "j1", quote: "[text removed: 13 characters]" });
  });

  it("reports a request error with its route and path but not its query", async () => {
    initObservability("web", { dsn: "https://key@example.test/1", transport });
    captureRequestError(new Error("render failed"), { path: "/api/spaces/1?token=secret&q=ada@example.com", method: "POST" }, { routePath: "/api/spaces/[id]", routeType: "route", routerKind: "App Router" });
    await flushObservability();
    const event = sent.find((e) => e.exception)!;
    expect(event.tags).toMatchObject({ routePath: "/api/spaces/[id]" });
    expect(event.extra).toMatchObject({ method: "POST", path: "/api/spaces/1" });
    expect(JSON.stringify(event).match(/token=secret|ada@/)).toBeNull();
  });
});
