import { describe, it, expect } from "vitest";
import {
  encryptCredentials,
  decryptCredentials,
  isEncryptedData,
  EncryptedData,
} from "../crypto";

describe("Review Credentials Crypto", () => {
  it("correctly identifies encrypted data shape", () => {
    expect(isEncryptedData(null)).toBe(false);
    expect(isEncryptedData("string")).toBe(false);
    expect(isEncryptedData({})).toBe(false);
    expect(
      isEncryptedData({
        encrypted: "abcd",
        iv: "1234",
        tag: "5678",
      })
    ).toBe(true);
  });

  it("encrypts and decrypts credentials accurately", () => {
    const original = {
      apiKey: "AIzaSyD-fake-key-12345",
      placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
      businessName: "Acme Coffee",
    };

    const encrypted = encryptCredentials(original);

    expect(isEncryptedData(encrypted)).toBe(true);
    expect(encrypted.encrypted).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();
    expect(encrypted.encrypted).not.toContain("AIzaSyD");

    const decrypted = decryptCredentials(encrypted);
    expect(decrypted).toEqual(original);
  });

  it("returns plain object as-is if already unencrypted (backward compatibility)", () => {
    const plain = { apiKey: "key-123", domain: "example.com" };
    const result = decryptCredentials(plain);
    expect(result).toEqual(plain);
  });

  it("returns empty object for null, undefined, or primitive input", () => {
    expect(decryptCredentials(null)).toEqual({});
    expect(decryptCredentials(undefined)).toEqual({});
    expect(decryptCredentials("not an object")).toEqual({});
  });

  it("fails gracefully and returns empty object on tampered ciphertext", () => {
    const original = { secret: "confidential" };
    const encrypted = encryptCredentials(original);

    // Tamper with ciphertext
    const tampered: EncryptedData = {
      ...encrypted,
      encrypted:
        (encrypted.encrypted[0] === "f" ? "0" : "f") +
        encrypted.encrypted.slice(1),
    };

    const result = decryptCredentials(tampered);
    expect(result).toEqual({});
  });
});

describe("which secret protects stored credentials", () => {
  it("uses ENCRYPTION_KEY when it is set", async () => {
    const { encryptionSecret } = await import("../crypto");
    expect(encryptionSecret({ ENCRYPTION_KEY: "k1", BETTER_AUTH_SECRET: "other", NODE_ENV: "production" })).toBe("k1");
    expect(encryptionSecret({ ENCRYPTION_KEY: "k1", NODE_ENV: "development" })).toBe("k1");
  });

  it("outside production, falls back to the sign-in secret", async () => {
    const { encryptionSecret } = await import("../crypto");
    expect(encryptionSecret({ BETTER_AUTH_SECRET: "auth-secret", NODE_ENV: "development" })).toBe("auth-secret");
    expect(encryptionSecret({ BETTER_AUTH_SECRET: "auth-secret" })).toBe("auth-secret");
  });

  it("in production, refuses to run without ENCRYPTION_KEY, even when the sign-in secret is set", async () => {
    const { encryptionSecret } = await import("../crypto");
    expect(() => encryptionSecret({ BETTER_AUTH_SECRET: "auth-secret", NODE_ENV: "production" })).toThrow(/ENCRYPTION_KEY is not set/);
  });

  it("has no built-in default: with nothing set it refuses instead of using a value anyone can read", async () => {
    const { encryptionSecret } = await import("../crypto");
    expect(() => encryptionSecret({})).toThrow(/Set ENCRYPTION_KEY/);
    expect(() => encryptionSecret({ NODE_ENV: "development" })).toThrow();
  });

  it("the source no longer contains a fallback secret", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(fileURLToPath(new URL("../crypto.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/vouchreel-secret-fallback/);
  });

  it("a missing key is reported when decrypting, not mistaken for empty credentials", async () => {
    const before = { ...process.env };
    const sealed = encryptCredentials({ apiKey: "k" });
    delete process.env.ENCRYPTION_KEY;
    delete process.env.BETTER_AUTH_SECRET;
    try {
      expect(() => decryptCredentials(sealed)).toThrow(/ENCRYPTION_KEY/);
    } finally {
      Object.assign(process.env, before);
    }
  });

  it("credentials sealed with one key cannot be read with another", async () => {
    const sealed = encryptCredentials({ apiKey: "secret" });
    const before = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "a-different-key";
    try {
      expect(decryptCredentials(sealed)).toEqual({});
    } finally {
      process.env.ENCRYPTION_KEY = before;
    }
  });
});
