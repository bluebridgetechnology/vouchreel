import { describe, it, expect, vi } from "vitest";
import {
  generateApiKey,
  hashApiKey,
  authenticateApiKey,
  KEY_PREFIX,
} from "../api-keys";

// Mock the db client
vi.mock("@/lib/db", () => {
  return {
    db: {
      select: vi.fn(),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      })),
    },
  };
});

describe("API Key Utilities", () => {
  it("generates well-formed API keys with correct prefix", () => {
    const key = generateApiKey();

    expect(key.rawKey.startsWith(KEY_PREFIX)).toBe(true);
    expect(key.rawKey.length).toBeGreaterThan(40);
    expect(key.keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(key.keyPrefix.startsWith(KEY_PREFIX)).toBe(true);
    expect(key.keyPrefix.endsWith("...")).toBe(true);
  });

  it("produces deterministic SHA-256 hashes", () => {
    const rawKey = "vr_live_test_secret_123456789";
    const hash1 = hashApiKey(rawKey);
    const hash2 = hashApiKey(rawKey);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates distinct keys on consecutive calls", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();

    expect(key1.rawKey).not.toBe(key2.rawKey);
    expect(key1.keyHash).not.toBe(key2.keyHash);
  });

  describe("authenticateApiKey", () => {
    it("returns null when Authorization header is missing", async () => {
      const request = new Request("https://api.vouchreel.com/api/v1/spaces");
      const result = await authenticateApiKey(request);
      expect(result).toBeNull();
    });

    it("returns null when Authorization header does not have Bearer format", async () => {
      const request = new Request("https://api.vouchreel.com/api/v1/spaces", {
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      });
      const result = await authenticateApiKey(request);
      expect(result).toBeNull();
    });

    it("returns null when key does not have vr_live_ prefix", async () => {
      const request = new Request("https://api.vouchreel.com/api/v1/spaces", {
        headers: { Authorization: "Bearer sk_test_12345" },
      });
      const result = await authenticateApiKey(request);
      expect(result).toBeNull();
    });
  });
});
