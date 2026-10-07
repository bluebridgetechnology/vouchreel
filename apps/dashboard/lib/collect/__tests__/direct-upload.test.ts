import { describe, expect, it, vi } from "vitest";
import type { StorageAdapter } from "@/lib/storage/types";
import { MAX_VIDEO_BYTES, checkUploadedVideo, parsePendingKey, pendingKey } from "../direct-upload";

const FORM = "11111111-2222-3333-4444-555555555555";
const bytes = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
const mp4 = Uint8Array.from([0, 0, 0, 0x20, ...bytes("ftypisom"), 0, 0, 0, 0]);
const exe = Uint8Array.from([...bytes("MZ"), 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff]);

function adapter(object: { size: number; head: Uint8Array } | null): StorageAdapter {
  return {
    upload: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getSignedUrl: vi.fn(),
    head: async () => (object ? { size: object.size } : null),
    readStart: async () => object?.head ?? new Uint8Array(),
    publicUrl: (key: string) => `https://cdn.test/${key}`,
  } as unknown as StorageAdapter;
}

describe("pending upload keys", () => {
  it("are made under the form and parse back to the type their extension stands for", () => {
    const key = pendingKey(FORM, "webm");
    expect(key).toMatch(new RegExp(`^uploads/pending/${FORM}/[0-9a-f-]{36}\\.webm$`));
    expect(parsePendingKey(FORM, key)).toEqual({ extension: "webm", declaredType: "video/webm" });
    expect(parsePendingKey(FORM, key.replace(".webm", ".mov"))?.declaredType).toBe("video/quicktime");
  });

  it("are refused for another form, another folder, a bad name or a path trick", () => {
    const key = pendingKey(FORM, "mp4");
    expect(parsePendingKey("99999999-2222-3333-4444-555555555555", key)).toBeNull();
    expect(parsePendingKey(FORM, key.replace("uploads/pending", "submissions"))).toBeNull();
    expect(parsePendingKey(FORM, `uploads/pending/${FORM}/../../secrets.mp4`)).toBeNull();
    expect(parsePendingKey(FORM, `uploads/pending/${FORM}/not-a-uuid.mp4`)).toBeNull();
    expect(parsePendingKey(FORM, key.replace(".mp4", ".exe"))).toBeNull();
    expect(parsePendingKey(FORM, `${key}/extra`)).toBeNull();
  });
});

describe("checking what was uploaded straight to storage", () => {
  const key = pendingKey(FORM, "mp4");

  it("accepts a real video within the size limit and returns its public URL", async () => {
    expect(await checkUploadedVideo(adapter({ size: 5_000_000, head: mp4 }), FORM, key)).toEqual({ ok: true, url: `https://cdn.test/${key}`, size: 5_000_000 });
  });

  it("refuses a key that was never uploaded", async () => {
    const r = await checkUploadedVideo(adapter(null), FORM, key);
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.message).toMatch(/did not receive/i);
  });

  it("refuses an empty object and one over 100 MB, whatever the policy said", async () => {
    expect((await checkUploadedVideo(adapter({ size: 0, head: mp4 }), FORM, key)).ok).toBe(false);
    expect((await checkUploadedVideo(adapter({ size: MAX_VIDEO_BYTES + 1, head: mp4 }), FORM, key)).ok).toBe(false);
    expect((await checkUploadedVideo(adapter({ size: MAX_VIDEO_BYTES, head: mp4 }), FORM, key)).ok).toBe(true);
  });

  it("refuses a file that is not the video its extension claims (looked at the bytes, not the name)", async () => {
    const r = await checkUploadedVideo(adapter({ size: 1000, head: exe }), FORM, key);
    expect(r.ok === false && r.message).toMatch(/valid MP4/i);
    expect((await checkUploadedVideo(adapter({ size: 1000, head: mp4 }), FORM, pendingKey(FORM, "webm"))).ok).toBe(false); // MP4 bytes under a .webm name
  });

  it("refuses a key for a different form without asking storage anything", async () => {
    const a = adapter({ size: 1000, head: mp4 });
    const head = vi.fn(async () => ({ size: 1000 }));
    a.head = head;
    expect((await checkUploadedVideo(a, "99999999-2222-3333-4444-555555555555", key)).ok).toBe(false);
    expect(head).not.toHaveBeenCalled();
  });

  it("says so when the storage cannot do direct uploads", async () => {
    const plain = { upload: vi.fn(), delete: vi.fn(), list: vi.fn(), getSignedUrl: vi.fn() } as unknown as StorageAdapter;
    expect((await checkUploadedVideo(plain, FORM, key)).ok).toBe(false);
  });
});
