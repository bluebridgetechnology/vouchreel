import { mkdir, readdir, rm, stat, writeFile } from "fs/promises";
import path from "path";
import type { StorageAdapter, StoredFile, UploadOptions } from "./types";

/**
 * Development-only storage: writes files under public/local-uploads/ so the dev server can serve
 * them. It exists so features that upload (video renders, exports) can be tried without an S3 or
 * Bunny account. Refuses to run in production.
 *
 * Enable with STORAGE_PROVIDER=local. Optional: LOCAL_STORAGE_URL (default http://localhost:3000).
 */
export class LocalAdapter implements StorageAdapter {
  private readonly root: string;
  private readonly baseUrl: string;

  constructor() {
    if (process.env.NODE_ENV === "production") {
      throw new Error('STORAGE_PROVIDER="local" is for development only. Use s3, r2 or bunny in production.');
    }
    this.root = path.resolve(process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), "public", "local-uploads"));
    this.baseUrl = (process.env.LOCAL_STORAGE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  }

  /** Resolves a storage key to a path inside the root; rejects keys that would escape it. */
  private resolveKey(key: string): string {
    const target = path.resolve(this.root, key);
    if (target !== this.root && !target.startsWith(this.root + path.sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return target;
  }

  async upload(file: Buffer, key: string, _options?: UploadOptions): Promise<string> {
    const target = this.resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file);
    return `${this.baseUrl}/local-uploads/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }

  async *list(prefix: string): AsyncIterable<StoredFile> {
    const walk = async function* (dir: string, relative: string): AsyncIterable<StoredFile> {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return; // nothing stored under this folder
      }
      for (const entry of entries) {
        const key = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) yield* walk(path.join(dir, entry.name), key);
        else if (key.startsWith(prefix)) {
          const info = await stat(path.join(dir, entry.name));
          yield { key, size: info.size, lastModified: info.mtime };
        }
      }
    };
    yield* walk(this.root, "");
  }

  async getSignedUrl(key: string): Promise<string> {
    this.resolveKey(key);
    return `${this.baseUrl}/local-uploads/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
}
