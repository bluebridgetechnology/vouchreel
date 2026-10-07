import { describe, expect, it } from "vitest";
import { scrubSentryEvent, scrubString, scrubUrl, scrubValue } from "../scrub";

describe("scrubString", () => {
  it("removes emails, bearer tokens, JWTs and long tokens, keeps ids and plain words", () => {
    const uuid = "3f2b8c1e-5d4a-4b6f-9a7e-0c1d2e3f4a5b";
    expect(scrubString("sent to ada@example.com failed")).toBe("sent to [email] failed");
    expect(scrubString("Authorization: Bearer abcdef1234567890abcdef")).toBe("Authorization: Bearer [token]");
    expect(scrubString("jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123_-xyz here")).toBe("jwt [token] here");
    expect(scrubString("https://app.test/consent/withdraw?token=abc.def&x=1")).toBe("https://app.test/consent/withdraw?token=[redacted]&x=1");
    expect(scrubString("key 0123456789abcdef0123456789abcdef0123 end")).toBe("key [token] end");
    expect(scrubString(`video ${uuid} not found`)).toBe(`video ${uuid} not found`);
    expect(scrubString(`[worker] worker-${uuid} started`)).toBe(`[worker] worker-${uuid} started`);
    expect(scrubString(`id ${uuid}0123456789abcdef0123456789abcdef`)).toBe("id [token]");
  });

  it("clips very long text", () => {
    const out = scrubString("word ".repeat(1000));
    expect(out.length).toBeLessThan(2100);
    expect(out).toContain("more characters");
  });
});

describe("scrubUrl", () => {
  it("keeps the path and the names of the query values, not the values", () => {
    expect(scrubUrl("https://app.test/search?q=ada%40example.com&token=secret")).toBe("https://app.test/search?q=[removed]&token=[removed]");
    expect(scrubUrl("https://app.test/spaces/1")).toBe("https://app.test/spaces/1");
  });
});

describe("scrubValue", () => {
  it("redacts secrets and the words people wrote by key, and keeps counts and ids", () => {
    const out = scrubValue({
      videoId: "3f2b8c1e-5d4a-4b6f-9a7e-0c1d2e3f4a5b",
      attempts: 2,
      password: "hunter2",
      authToken: "abc",
      cookie: "session=abc",
      quote: "Great product, it saved us hours",
      customerEmail: "ada@example.com",
      nested: { script: "words words", ok: true },
      note: "contact ada@example.com",
    }) as Record<string, unknown>;
    expect(out).toEqual({
      videoId: "3f2b8c1e-5d4a-4b6f-9a7e-0c1d2e3f4a5b",
      attempts: 2,
      password: "[redacted]",
      authToken: "[redacted]",
      cookie: "[redacted]",
      quote: "[text removed: 32 characters]",
      customerEmail: "[text removed: 15 characters]",
      nested: { script: "[text removed: 11 characters]", ok: true },
      note: "contact [email]",
    });
  });

  it("turns errors into plain objects with a scrubbed message, and bounds depth and length", () => {
    const err = scrubValue(new Error("failed for ada@example.com")) as { name: string; message: string };
    expect(err).toMatchObject({ name: "Error", message: "failed for [email]" });
    const deep = scrubValue({ a: { b: { c: { d: { e: { f: 1 } } } } } });
    expect(JSON.stringify(deep)).toContain("[too deep]");
    expect((scrubValue(Array.from({ length: 50 }, (_, i) => i)) as unknown[]).length).toBe(21);
  });
});

describe("scrubbing is idempotent", () => {
  it("scrubbing twice gives the same result as once", () => {
    const once = scrubValue({ quote: "Great product", password: "x", note: "ada@example.com", nested: { script: "words" } });
    expect(scrubValue(once)).toEqual(once);
    expect(scrubString(scrubString("a ada@example.com token=abc"))).toBe(scrubString("a ada@example.com token=abc"));
  });
});

describe("scrubSentryEvent", () => {
  it("removes personal data from every part of an event and keeps what finds the bug", () => {
    const event = scrubSentryEvent({
      message: "failed for ada@example.com",
      exception: { values: [{ type: "TypeError", value: "bad token=abc123 for ada@example.com", stacktrace: { frames: [{ filename: "a.ts", lineno: 3, vars: { secret: "x" }, context_line: 'send("ada@example.com")', pre_context: ["const key = token=abc123"], post_context: [] }] } }] },
      request: {
        method: "POST",
        url: "https://app.test/api/collect/x?token=abc",
        cookies: { session: "abc" },
        data: { quote: "words" },
        query_string: "token=abc",
        headers: { cookie: "session=abc", authorization: "Bearer x", "content-type": "application/json", "user-agent": "UA" },
      },
      user: { id: "u1", email: "ada@example.com", ip_address: "1.2.3.4", username: "ada" },
      breadcrumbs: [{ message: "sent to ada@example.com", data: { url: "https://x.test/p?email=a@b.co", quote: "words" } }],
      extra: { reviewText: "words", count: 3 },
      tags: { service: "web" },
    });
    expect(event.message).toBe("failed for [email]");
    expect(event.exception.values[0]).toMatchObject({ type: "TypeError", value: "bad token=[redacted] for [email]" });
    expect(event.exception.values[0].stacktrace.frames[0]).toEqual({ filename: "a.ts", lineno: 3, context_line: 'send("[email]")', pre_context: ["const key = token=[redacted]"], post_context: [] });
    expect(event.request).toEqual({ method: "POST", url: "https://app.test/api/collect/x?token=[removed]", headers: { "content-type": "application/json", "user-agent": "UA" } });
    expect(event.user).toEqual({ id: "u1" });
    expect(event.breadcrumbs[0]).toEqual({ message: "sent to [email]", data: { url: "https://x.test/p?email=[removed]", quote: "[text removed: 5 characters]" } });
    expect(event.extra).toEqual({ reviewText: "[text removed: 5 characters]", count: 3 });
    expect(event.tags).toEqual({ service: "web" });
    expect(JSON.stringify(event)).not.toMatch(/ada@example|abc123|1\.2\.3\.4/);
  });

  it("an event with none of those parts passes through", () => {
    expect(scrubSentryEvent({ message: "ok" })).toEqual({ message: "ok" });
  });
});
