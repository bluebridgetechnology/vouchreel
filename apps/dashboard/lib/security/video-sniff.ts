export type VideoKind = "mp4" | "mov" | "webm" | "avi";

/** Declared MIME types we accept, mapped to the container they must actually contain. */
export const DECLARED_TYPES: Record<string, VideoKind[]> = {
  "video/mp4": ["mp4", "mov"], // some phones label QuickTime-brand files mp4
  "video/quicktime": ["mov", "mp4"],
  "video/webm": ["webm"],
  "video/x-msvideo": ["avi"],
};

/**
 * Identifies a video container from its first bytes. The Content-Type of an upload is
 * client-controlled, so this is what decides whether a file really is a video before we
 * store it and hand it to FFmpeg.
 */
export function sniffVideoKind(head: Uint8Array): VideoKind | null {
  if (head.length < 12) return null;
  const ascii = (start: number, end: number) => String.fromCharCode(...head.slice(start, end));

  // ISO base media (MP4 / QuickTime): size(4) "ftyp" brand(4)
  if (ascii(4, 8) === "ftyp") return ascii(8, 12) === "qt  " ? "mov" : "mp4";
  // Matroska / WebM EBML header
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "webm";
  // RIFF....AVI
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "AVI ") return "avi";
  return null;
}

/** True when the declared MIME type is allowed and the bytes are a matching container. */
export function matchesDeclaredType(declared: string, head: Uint8Array): boolean {
  const allowed = DECLARED_TYPES[declared];
  const kind = sniffVideoKind(head);
  return Boolean(allowed && kind && allowed.includes(kind));
}
