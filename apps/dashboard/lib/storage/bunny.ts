import type { StorageAdapter, StoredFile, UploadOptions } from "./types";

/**
 * Bunny.net Storage adapter.
 * Uses Bunny.net's HTTP API for file operations.
 *
 * Required env vars:
 * - STORAGE_KEY: Bunny.net Storage API key
 * - STORAGE_BUCKET: Storage zone name
 * - STORAGE_REGION: Storage region (e.g., "de", "ny", "la", "sg", "syd")
 * - STORAGE_ENDPOINT: CDN pull zone URL (for public URLs)
 */
export class BunnyAdapter implements StorageAdapter {
  private apiKey: string;
  private storageZone: string;
  private baseUrl: string;
  private cdnUrl: string;

  constructor() {
    const apiKey = process.env.STORAGE_KEY;
    const storageZone = process.env.STORAGE_BUCKET;
    const region = process.env.STORAGE_REGION || "de";
    const cdnUrl = process.env.STORAGE_ENDPOINT;

    if (!apiKey) {
      throw new Error("STORAGE_KEY environment variable is required for Bunny storage");
    }
    if (!storageZone) {
      throw new Error("STORAGE_BUCKET environment variable is required for Bunny storage");
    }
    if (!cdnUrl) {
      throw new Error(
        "STORAGE_ENDPOINT environment variable is required for Bunny storage (CDN pull zone URL)"
      );
    }

    this.apiKey = apiKey;
    this.storageZone = storageZone;
    this.cdnUrl = cdnUrl.replace(/\/$/, "");

    // Bunny.net storage API endpoint varies by region
    const regionHost =
      region === "de"
        ? "storage.bunnycdn.com"
        : `${region}.storage.bunnycdn.com`;
    this.baseUrl = `https://${regionHost}/${storageZone}`;
  }

  async upload(
    file: Buffer,
    key: string,
    options?: UploadOptions
  ): Promise<string> {
    const url = `${this.baseUrl}/${key}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        AccessKey: this.apiKey,
        "Content-Type": options?.contentType || "application/octet-stream",
      },
      body: new Uint8Array(file),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Bunny upload failed (${response.status}): ${body}`);
    }

    return `${this.cdnUrl}/${key}`;
  }

  async delete(key: string): Promise<void> {
    const url = `${this.baseUrl}/${key}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        AccessKey: this.apiKey,
      },
    });

    if (!response.ok && response.status !== 404) {
      const body = await response.text();
      throw new Error(`Bunny delete failed (${response.status}): ${body}`);
    }
  }

  /**
   * Lists a folder through Bunny's storage API (GET {zone}/{folder}/ returns a JSON array) and walks
   * into sub-folders. Not run against a real storage zone yet.
   */
  async *list(prefix: string): AsyncIterable<StoredFile> {
    const walk = async function* (self: BunnyAdapter, folder: string): AsyncIterable<StoredFile> {
      const response = await fetch(`${self.baseUrl}/${folder}`, { headers: { AccessKey: self.apiKey, Accept: "application/json" } });
      if (response.status === 404) return;
      if (!response.ok) throw new Error(`Bunny list failed (${response.status}): ${await response.text()}`);
      const items = (await response.json()) as { ObjectName: string; IsDirectory: boolean; Length: number; LastChanged: string }[];
      for (const item of items) {
        const key = `${folder}${item.ObjectName}`;
        if (item.IsDirectory) yield* walk(self, `${key}/`);
        else if (key.startsWith(prefix)) yield { key, size: item.Length, lastModified: new Date(`${item.LastChanged}Z`) };
      }
    };
    // Start from the deepest whole folder in the prefix, then filter by the rest
    const folder = prefix.includes("/") ? prefix.slice(0, prefix.lastIndexOf("/") + 1) : "";
    yield* walk(this, folder);
  }

  async getSignedUrl(key: string, _expiresIn = 3600): Promise<string> {
    // Bunny.net CDN supports token authentication for signed URLs.
    // For MVP, we return the public CDN URL directly.
    // Token signing can be added in Phase 2 for private content.
    return `${this.cdnUrl}/${key}`;
  }
}
