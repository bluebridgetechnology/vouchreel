import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientIp } from "../client-ip";

const h = (init: Record<string, string>) => new Headers(init);

afterEach(() => vi.unstubAllEnvs());

describe("getClientIp", () => {
  it("uses the entry our trusted proxy appended, not the spoofable first one", () => {
    // client sent a fake first hop; the proxy appended the real address last
    expect(getClientIp(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(getClientIp(h({ "x-forwarded-for": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("rotating a forged first entry does not change the identity", () => {
    const a = getClientIp(h({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }));
    const b = getClientIp(h({ "x-forwarded-for": "2.2.2.2, 203.0.113.9" }));
    expect(a).toBe(b);
  });

  it("counts from the right across several trusted proxies", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    expect(getClientIp(h({ "x-forwarded-for": "9.9.9.9, 203.0.113.9, 172.16.0.2" }))).toBe("203.0.113.9");
  });

  it("ignores forwarding headers when the app is exposed directly", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "0");
    expect(getClientIp(h({ "x-forwarded-for": "203.0.113.9" }))).toBe("unknown");
  });

  it("falls back to x-real-ip, handles IPv6 and rejects garbage", () => {
    expect(getClientIp(h({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(getClientIp(h({ "x-forwarded-for": "2606:4700::1111" }))).toBe("2606:4700::1111");
    expect(getClientIp(h({ "x-forwarded-for": "not-an-ip" }))).toBe("unknown");
    expect(getClientIp(h({}))).toBe("unknown");
  });
});
