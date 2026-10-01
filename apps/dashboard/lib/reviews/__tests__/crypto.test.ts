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
