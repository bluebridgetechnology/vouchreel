import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createStorageAdapter, getStorage } from "../index";
import { S3Adapter } from "../s3";
import { BunnyAdapter } from "../bunny";

describe("Storage Adapter", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createStorageAdapter factory", () => {
    it("throws a clear error when STORAGE_PROVIDER is not set", () => {
      delete process.env.STORAGE_PROVIDER;
      expect(() => createStorageAdapter()).toThrow(
        /STORAGE_PROVIDER environment variable is required/
      );
    });

    it("throws a clear error when STORAGE_PROVIDER is invalid", () => {
      process.env.STORAGE_PROVIDER = "invalid-provider";
      expect(() => createStorageAdapter()).toThrow(
        /Invalid STORAGE_PROVIDER: "invalid-provider"/
      );
    });

    it("returns an S3Adapter instance when STORAGE_PROVIDER=s3", () => {
      process.env.STORAGE_PROVIDER = "s3";
      process.env.STORAGE_BUCKET = "test-bucket";
      process.env.STORAGE_KEY = "test-key";
      process.env.STORAGE_SECRET = "test-secret";
      process.env.STORAGE_REGION = "us-east-1";

      const adapter = createStorageAdapter();
      expect(adapter).toBeInstanceOf(S3Adapter);
      expect(typeof adapter.upload).toBe("function");
      expect(typeof adapter.delete).toBe("function");
      expect(typeof adapter.getSignedUrl).toBe("function");
    });

    it("returns an S3Adapter instance when STORAGE_PROVIDER=r2", () => {
      process.env.STORAGE_PROVIDER = "r2";
      process.env.STORAGE_BUCKET = "test-bucket";
      process.env.STORAGE_KEY = "test-key";
      process.env.STORAGE_SECRET = "test-secret";
      process.env.STORAGE_ENDPOINT = "https://r2.cloudflarestorage.com";

      const adapter = createStorageAdapter();
      expect(adapter).toBeInstanceOf(S3Adapter);
    });

    it("returns a BunnyAdapter instance when STORAGE_PROVIDER=bunny", () => {
      process.env.STORAGE_PROVIDER = "bunny";
      process.env.STORAGE_KEY = "bunny-api-key";
      process.env.STORAGE_BUCKET = "my-storage-zone";
      process.env.STORAGE_ENDPOINT = "https://myzone.b-cdn.net";

      const adapter = createStorageAdapter();
      expect(adapter).toBeInstanceOf(BunnyAdapter);
      expect(typeof adapter.upload).toBe("function");
      expect(typeof adapter.delete).toBe("function");
      expect(typeof adapter.getSignedUrl).toBe("function");
    });
  });

  describe("S3Adapter validation", () => {
    it("throws when STORAGE_BUCKET is missing", () => {
      delete process.env.STORAGE_BUCKET;
      process.env.STORAGE_KEY = "test-key";
      process.env.STORAGE_SECRET = "test-secret";

      expect(() => new S3Adapter()).toThrow(
        /STORAGE_BUCKET environment variable is required/
      );
    });

    it("throws when STORAGE_KEY or STORAGE_SECRET is missing", () => {
      process.env.STORAGE_BUCKET = "test-bucket";
      delete process.env.STORAGE_KEY;
      delete process.env.STORAGE_SECRET;

      expect(() => new S3Adapter()).toThrow(
        /STORAGE_KEY and STORAGE_SECRET environment variables are required/
      );
    });
  });

  describe("BunnyAdapter validation", () => {
    it("throws when STORAGE_KEY is missing", () => {
      delete process.env.STORAGE_KEY;
      process.env.STORAGE_BUCKET = "my-zone";
      process.env.STORAGE_ENDPOINT = "https://myzone.b-cdn.net";

      expect(() => new BunnyAdapter()).toThrow(
        /STORAGE_KEY environment variable is required/
      );
    });

    it("throws when STORAGE_BUCKET is missing", () => {
      process.env.STORAGE_KEY = "key";
      delete process.env.STORAGE_BUCKET;
      process.env.STORAGE_ENDPOINT = "https://myzone.b-cdn.net";

      expect(() => new BunnyAdapter()).toThrow(
        /STORAGE_BUCKET environment variable is required/
      );
    });

    it("throws when STORAGE_ENDPOINT is missing", () => {
      process.env.STORAGE_KEY = "key";
      process.env.STORAGE_BUCKET = "my-zone";
      delete process.env.STORAGE_ENDPOINT;

      expect(() => new BunnyAdapter()).toThrow(
        /STORAGE_ENDPOINT environment variable is required/
      );
    });
  });

  describe("getStorage singleton", () => {
    it("returns the singleton instance across calls", () => {
      process.env.STORAGE_PROVIDER = "s3";
      process.env.STORAGE_BUCKET = "test-bucket";
      process.env.STORAGE_KEY = "test-key";
      process.env.STORAGE_SECRET = "test-secret";

      const adapter1 = getStorage();
      const adapter2 = getStorage();
      expect(adapter1).toBe(adapter2);
    });
  });
});
