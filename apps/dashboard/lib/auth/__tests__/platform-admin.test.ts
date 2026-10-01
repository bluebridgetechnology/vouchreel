import { describe, expect, it } from "vitest";
import { isPlatformAdmin } from "../platform-admin";

describe("isPlatformAdmin", () => {
  it("is true only for an explicit true flag", () => {
    expect(isPlatformAdmin({ isPlatformAdmin: true })).toBe(true);
    expect(isPlatformAdmin({ isPlatformAdmin: false })).toBe(false);
    expect(isPlatformAdmin({ isPlatformAdmin: "true" })).toBe(false);
    expect(isPlatformAdmin({})).toBe(false);
    expect(isPlatformAdmin(null)).toBe(false);
    expect(isPlatformAdmin(undefined)).toBe(false);
  });

  it("ignores customer roles", () => {
    expect(isPlatformAdmin({ role: "owner" })).toBe(false);
    expect(isPlatformAdmin({ role: "admin" })).toBe(false);
  });
});
