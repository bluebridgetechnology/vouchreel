/**
 * Working out which stored file a public URL points at. Everything this app uploads goes under one of
 * a few fixed prefixes and its public URL contains the storage key, so the key can be recovered.
 */

/** Every prefix the app uploads under. */
export const FILE_PREFIXES = ["ai-videos/", "review-videos/", "social-exports/", "submissions/"] as const;

/** The key inside a public file URL, starting at the first of `prefixes` found; null if none or if it looks unsafe. */
export function keyFromUrl(url: string | null | undefined, prefixes: readonly string[] = FILE_PREFIXES): string | null {
  if (!url) return null;
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
  let at = -1;
  for (const prefix of prefixes) {
    const i = pathname.indexOf(prefix);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return null;
  const key = pathname.slice(at);
  if (key.split("/").some((part) => part === ".." || part === "." || part === "")) return null;
  return key;
}
