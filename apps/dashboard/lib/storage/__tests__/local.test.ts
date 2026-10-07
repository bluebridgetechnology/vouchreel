import { mkdtemp, readFile, rm } from "fs/promises";
import { existsSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStorageAdapter } from "../index";
import { LocalAdapter } from "../local";

describe("LocalAdapter (development storage)", () => {
  const originalEnv = process.env;
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "vr-local-storage-"));
    process.env = { ...originalEnv, LOCAL_STORAGE_DIR: dir, LOCAL_STORAGE_URL: "http://localhost:3000/" };
    (process.env as Record<string, string>).NODE_ENV = "development";
  });

  afterEach(async () => {
    process.env = originalEnv;
    await rm(dir, { recursive: true, force: true });
  });

  it("writes the file under the root and returns a public URL", async () => {
    const adapter = new LocalAdapter();
    const url = await adapter.upload(Buffer.from("video-bytes"), "review-videos/space 1/a.mp4");
    expect(url).toBe("http://localhost:3000/local-uploads/review-videos/space%201/a.mp4");
    expect((await readFile(path.join(dir, "review-videos", "space 1", "a.mp4"))).toString()).toBe("video-bytes");
  });

  it("deletes files and tolerates missing ones", async () => {
    const adapter = new LocalAdapter();
    await adapter.upload(Buffer.from("x"), "a/b.txt");
    await adapter.delete("a/b.txt");
    expect(existsSync(path.join(dir, "a", "b.txt"))).toBe(false);
    await expect(adapter.delete("a/b.txt")).resolves.toBeUndefined();
  });

  it("lists the files under a prefix, with their size and age, through nested folders", async () => {
    const adapter = new LocalAdapter();
    await adapter.upload(Buffer.from("12345"), "ai-videos/s1/t1/a.mp4");
    await adapter.upload(Buffer.from("123"), "ai-videos/s1/t2/b.mp4");
    await adapter.upload(Buffer.from("1"), "review-videos/s1/c.mp4");
    const listed = async (prefix: string) => {
      const out = [];
      for await (const f of adapter.list(prefix)) out.push(f);
      return out.sort((a, b) => a.key.localeCompare(b.key));
    };
    const ai = await listed("ai-videos/");
    expect(ai.map((f) => [f.key, f.size])).toEqual([["ai-videos/s1/t1/a.mp4", 5], ["ai-videos/s1/t2/b.mp4", 3]]);
    expect(Math.abs(ai[0].lastModified.getTime() - Date.now())).toBeLessThan(60_000);
    expect((await listed("ai-videos/s1/t2/")).map((f) => f.key)).toEqual(["ai-videos/s1/t2/b.mp4"]);
    expect(await listed("social-exports/")).toEqual([]); // a prefix with nothing under it
  });

  it("refuses keys that would escape the storage root", async () => {
    const adapter = new LocalAdapter();
    await expect(adapter.upload(Buffer.from("x"), "../outside.txt")).rejects.toThrow(/Invalid storage key/);
    await expect(adapter.upload(Buffer.from("x"), "a/../../outside.txt")).rejects.toThrow(/Invalid storage key/);
    await expect(adapter.delete("../outside.txt")).rejects.toThrow(/Invalid storage key/);
  });

  it("is selectable via STORAGE_PROVIDER=local, but never in production", () => {
    process.env.STORAGE_PROVIDER = "local";
    expect(createStorageAdapter()).toBeInstanceOf(LocalAdapter);
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(() => createStorageAdapter()).toThrow(/development only/);
  });
});
