import { afterEach, describe, expect, it, vi } from "vitest";
import { UnsafeUrlError, assertPublicUrl, isPrivateIp, safeFetch } from "../ssrf";

const pub = async () => ["93.184.216.34"];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("isPrivateIp", () => {
  it.each([
    "0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "127.8.9.10", "169.254.169.254", "172.16.0.1", "172.31.255.255",
    "192.168.1.1", "198.18.0.1", "224.0.0.1", "240.0.0.1", "255.255.255.255",
    "::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "2001:db8::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1",
    "64:ff9b::a00:1",
  ])("blocks %s", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "93.184.216.34", "172.32.0.1", "100.63.255.255", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "allows %s",
    (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    }
  );

  it("fails closed on garbage", () => {
    expect(isPrivateIp("not-an-ip")).toBe(true);
  });
});

describe("assertPublicUrl", () => {
  it("accepts a public https URL that resolves to a public address", async () => {
    const url = await assertPublicUrl("https://hooks.example.com/in", { resolve: pub });
    expect(url.hostname).toBe("hooks.example.com");
  });

  it("rejects private literals, loopback names and credentials", async () => {
    for (const bad of [
      "https://127.0.0.1/x",
      "https://[::1]/x",
      "https://169.254.169.254/latest/meta-data",
      "https://10.0.0.5/x",
      "https://localhost/x",
      "https://foo.localhost/x",
      "https://db.internal/x",
      "https://2130706433/x", // decimal form of 127.0.0.1 is normalised by URL
      "https://user:pw@example.com/x",
    ]) {
      await expect(assertPublicUrl(bad, { resolve: pub })).rejects.toBeInstanceOf(UnsafeUrlError);
    }
  });

  it("rejects hostnames that resolve to a private address (DNS pointing inward)", async () => {
    await expect(assertPublicUrl("https://evil.example.com", { resolve: async () => ["10.0.0.7"] })).rejects.toThrow(/private/);
    // one bad answer among good ones is enough to reject
    await expect(
      assertPublicUrl("https://mixed.example.com", { resolve: async () => ["93.184.216.34", "127.0.0.1"] })
    ).rejects.toThrow(/private/);
  });

  it("rejects unresolvable hosts", async () => {
    await expect(
      assertPublicUrl("https://nope.example.com", { resolve: async () => { throw new Error("ENOTFOUND"); } })
    ).rejects.toThrow(/resolved/);
  });

  it("requires https in production, allows http elsewhere", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(assertPublicUrl("http://example.com", { resolve: pub })).rejects.toThrow(/https/);
    vi.stubEnv("NODE_ENV", "development");
    await expect(assertPublicUrl("http://example.com", { resolve: pub })).resolves.toBeInstanceOf(URL);
  });

  it("only honours the private-target escape hatch outside production", async () => {
    vi.stubEnv("ALLOW_PRIVATE_WEBHOOK_TARGETS", "true");
    vi.stubEnv("NODE_ENV", "development");
    await expect(assertPublicUrl("http://localhost:4000/hook")).resolves.toBeInstanceOf(URL);
    vi.stubEnv("NODE_ENV", "production");
    await expect(assertPublicUrl("https://localhost/hook", { resolve: pub })).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});

describe("safeFetch", () => {
  it("re-validates every redirect hop", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(safeFetch("https://public.example.com/start", {}, { resolve: pub, allowHttp: true })).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows safe redirects and never lets fetch follow them itself", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: "/final" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await safeFetch("https://public.example.com/start", {}, { resolve: pub });
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit).redirect === "manual")).toBe(true);
  });

  it("gives up after too many redirects", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://public.example.com/loop" } })));
    await expect(safeFetch("https://public.example.com/loop", {}, { resolve: pub, maxRedirects: 2 })).rejects.toThrow(/redirects/);
  });
});
