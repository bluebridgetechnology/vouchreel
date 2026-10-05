import type { StorageAdapter } from "./types";
import { S3Adapter } from "./s3";
import { BunnyAdapter } from "./bunny";
import { LocalAdapter } from "./local";

export type { StorageAdapter, UploadOptions } from "./types";

type StorageProviderType = "s3" | "r2" | "bunny" | "local";

/**
 * Factory function that returns the correct storage adapter based on
 * the STORAGE_PROVIDER environment variable.
 *
 * - `s3`: AWS S3
 * - `r2`: Cloudflare R2 (uses S3-compatible adapter with custom endpoint)
 * - `bunny`: Bunny.net Storage
 * - `local`: files under public/local-uploads (development only)
 *
 * Throws a clear error if the env var is missing or invalid.
 */
export function createStorageAdapter(): StorageAdapter {
  const provider = process.env.STORAGE_PROVIDER as
    | StorageProviderType
    | undefined;

  if (!provider) {
    throw new Error(
      "STORAGE_PROVIDER environment variable is required. " +
      'Valid values: "s3", "r2", "bunny", "local" (development only).'
    );
  }

  switch (provider) {
    case "s3":
    case "r2":
      // R2 is S3-compatible — the S3Adapter handles the endpoint override
      return new S3Adapter();

    case "bunny":
      return new BunnyAdapter();

    case "local":
      return new LocalAdapter();

    default:
      throw new Error(
        `Invalid STORAGE_PROVIDER: "${provider}". ` +
        'Valid values: "s3", "r2", "bunny", "local" (development only).'
      );
  }
}

// Lazy singleton — created on first access
let _storage: StorageAdapter | null = null;

/** Get the singleton storage adapter instance */
export function getStorage(): StorageAdapter {
  if (!_storage) {
    _storage = createStorageAdapter();
  }
  return _storage;
}
