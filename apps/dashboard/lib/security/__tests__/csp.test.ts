import { describe, expect, it } from "vitest";
import { buildCsp, cspHeaderName, cspMode, makeNonce, storageOrigin } from "../csp";

describe("Content Security Policy", () => {
  it("makes a different nonce every time, in a shape Next.js can read", () => {
    const nonces = new Set(Array.from({ length: 50 }, makeNonce));
    expect(nonces.size).toBe(50);
    for (const n of nonces) expect(n).toMatch(/^[A-Za-z0-9+/_-]+={0,2}$/);
  });

  it("lets only scripts with the nonce run, and no eval in production", () => {
    const csp = buildCsp({ nonce: "abc123" });
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(buildCsp({ nonce: "abc123", dev: true })).toContain("'unsafe-eval'");
  });

  it("allows inline styles (no nonce on styles, or browsers would ignore 'unsafe-inline')", () => {
    const csp = buildCsp({ nonce: "n" });
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).not.toMatch(/style-src[^;]*nonce/);
  });

  it("lets the preview player's silent audio (a data: URL) play", () => {
    expect(buildCsp({ nonce: "n" })).toMatch(/media-src [^;]*data:/);
  });

  it("keeps the framing rules out (next.config.ts owns frame-ancestors) and the lockdowns in", () => {
    const csp = buildCsp({ nonce: "n" });
    expect(csp).not.toContain("frame-ancestors");
    for (const d of ["object-src 'none'", "base-uri 'self'", "form-action 'self'", "default-src 'self'", "report-uri /api/csp-report"]) expect(csp).toContain(d);
  });

  it("allows the browser to talk to the bucket for direct uploads, and to nothing else beyond itself", () => {
    expect(buildCsp({ nonce: "n", storage: "https://bucket.s3.eu-west-1.amazonaws.com" })).toContain("connect-src 'self' https://bucket.s3.eu-west-1.amazonaws.com");
    expect(buildCsp({ nonce: "n" })).toContain("connect-src 'self';");
  });

  it("finds the bucket's address from the storage settings, only for S3 and R2", () => {
    expect(storageOrigin({ STORAGE_PROVIDER: "r2", STORAGE_ENDPOINT: "https://acct.r2.cloudflarestorage.com/some/path" })).toBe("https://acct.r2.cloudflarestorage.com");
    expect(storageOrigin({ STORAGE_PROVIDER: "s3", STORAGE_BUCKET: "vr", STORAGE_REGION: "eu-west-1" })).toBe("https://vr.s3.eu-west-1.amazonaws.com");
    expect(storageOrigin({ STORAGE_PROVIDER: "s3", STORAGE_BUCKET: "vr" })).toBe("https://vr.s3.us-east-1.amazonaws.com");
    expect(storageOrigin({ STORAGE_PROVIDER: "bunny", STORAGE_BUCKET: "x" })).toBeNull();
    expect(storageOrigin({ STORAGE_PROVIDER: "local" })).toBeNull();
    expect(storageOrigin({ STORAGE_PROVIDER: "r2", STORAGE_ENDPOINT: "not a url" })).toBeNull();
  });

  it("enforces unless told otherwise (an unknown value does not weaken it)", () => {
    expect(cspMode(undefined)).toBe("enforce");
    expect(cspMode("nonsense")).toBe("enforce");
    expect(cspMode("enforce")).toBe("enforce");
    expect(cspMode("off")).toBe("off");
    expect(cspHeaderName("report-only")).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeaderName("enforce")).toBe("Content-Security-Policy");
  });
});
