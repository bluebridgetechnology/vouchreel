import { getStorage } from "@/lib/storage";
import { keyFromUrl } from "./keys";

/**
 * Deleting the stored file behind a finished video. Videos are uploaded under a fixed prefix and
 * their public URL contains the storage key, so the key can be recovered from the URL.
 */

export type VideoFileKind = "ai" | "review";

const KEY_PREFIX: Record<VideoFileKind, string> = { ai: "ai-videos/", review: "review-videos/" };

/** The storage key inside a public file URL, or null when the URL does not look like ours. */
export function storageKeyFromUrl(url: string, kind: VideoFileKind): string | null {
  return keyFromUrl(url, [KEY_PREFIX[kind]]);
}

/**
 * Deletes the file a video's URL points at.
 *  - "deleted": the file is gone (or was already).
 *  - "none": the video had no URL.
 *  - "unrecognized": the URL is not one this app wrote, so nothing could be deleted.
 * Throws when the storage provider fails, so the caller can leave everything as it was and retry.
 */
export async function deleteVideoFile(url: string | null | undefined, kind: VideoFileKind): Promise<"deleted" | "none" | "unrecognized"> {
  if (!url) return "none";
  const key = storageKeyFromUrl(url, kind);
  if (!key) {
    console.warn(`[storage] could not tell which file ${url} is; it was not deleted`);
    return "unrecognized";
  }
  await getStorage().delete(key);
  return "deleted";
}
