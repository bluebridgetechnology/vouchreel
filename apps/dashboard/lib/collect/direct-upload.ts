import { randomUUID } from "node:crypto";
import type { StorageAdapter } from "@/lib/storage/types";
import { matchesDeclaredType } from "@/lib/security/video-sniff";

/**
 * Letting a customer's browser upload a video straight to storage (S3 or R2), so up to 100 MB does not pass
 * through our server. The server hands out a presigned POST for one key, and later checks that what arrived
 * under that key is really a video of an allowed size before a submission may use it.
 */

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export const VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-msvideo": "avi",
};
const TYPE_BY_EXTENSION = Object.fromEntries(Object.entries(VIDEO_EXTENSIONS).map(([type, ext]) => [ext, type]));

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** A new key for an upload that no submission refers to yet. */
export function pendingKey(formId: string, extension: string): string {
  return `uploads/pending/${formId}/${randomUUID()}.${extension}`;
}

/** The declared type a key's extension stands for, if the key is a pending upload for this form. */
export function parsePendingKey(formId: string, key: string): { extension: string; declaredType: string } | null {
  const match = new RegExp(`^uploads/pending/${formId}/${UUID}\\.(mp4|webm|mov|avi)$`, "i").exec(key);
  if (!match) return null;
  const extension = match[1].toLowerCase();
  return { extension, declaredType: TYPE_BY_EXTENSION[extension] };
}

export type UploadCheck = { ok: true; url: string; size: number } | { ok: false; message: string };

/** The object exists, is not empty or too big, and its first bytes are the container its extension says. */
export async function checkUploadedVideo(storage: StorageAdapter, formId: string, key: string): Promise<UploadCheck> {
  const parsed = parsePendingKey(formId, key);
  if (!parsed) return { ok: false, message: "That upload is not valid. Please choose the video again." };
  if (!storage.head || !storage.readStart || !storage.publicUrl) return { ok: false, message: "Direct uploads are not available." };

  const object = await storage.head(key);
  if (!object) return { ok: false, message: "We did not receive your video. Please upload it again." };
  if (object.size < 1 || object.size > MAX_VIDEO_BYTES) {
    return { ok: false, message: "Video must be MP4, WebM, MOV, or AVI and no larger than 100 MB" };
  }
  const head = await storage.readStart(key, 16);
  if (!matchesDeclaredType(parsed.declaredType, head)) {
    return { ok: false, message: "That file does not look like a valid MP4, WebM, MOV, or AVI video" };
  }
  return { ok: true, url: storage.publicUrl(key), size: object.size };
}
