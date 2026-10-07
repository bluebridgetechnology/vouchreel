/**
 * The Content Security Policy sent with every page, built per request around a fresh nonce: scripts run
 * only if they carry it (or were loaded by one that does), so an injected <script> is inert.
 *
 * It is rolled out in stages (CSP_MODE): "report-only" (the default) sends the policy as
 * Content-Security-Policy-Report-Only, so a violation is reported to /api/csp-report but nothing is
 * blocked; "enforce" blocks; "off" sends nothing. The frame rules (who may embed what) stay in
 * next.config.ts, unchanged.
 */

export type CspMode = "off" | "report-only" | "enforce";

export function cspMode(value = process.env.CSP_MODE): CspMode {
  return value === "enforce" || value === "off" ? value : "report-only";
}

export function cspHeaderName(mode: CspMode): "Content-Security-Policy" | "Content-Security-Policy-Report-Only" {
  return mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
}

/** A fresh, unguessable value for one request. */
export function makeNonce(): string {
  return btoa(crypto.randomUUID());
}

/** Where direct video uploads go (see lib/collect/direct-upload.ts): the browser POSTs to the bucket, so the policy must allow it. */
export function storageOrigin(env: Record<string, string | undefined> = process.env): string | null {
  if (env.STORAGE_PROVIDER !== "s3" && env.STORAGE_PROVIDER !== "r2") return null;
  try {
    if (env.STORAGE_ENDPOINT) return new URL(env.STORAGE_ENDPOINT).origin;
    if (env.STORAGE_BUCKET) return `https://${env.STORAGE_BUCKET}.s3.${env.STORAGE_REGION || "us-east-1"}.amazonaws.com`;
  } catch {
    // A malformed endpoint is reported by the storage adapter itself
  }
  return null;
}

export function buildCsp(options: { nonce: string; dev?: boolean; storage?: string | null }): string {
  const { nonce, dev = false, storage = null } = options;
  const directives = [
    "default-src 'self'",
    // 'strict-dynamic': a script that has the nonce may load others. React needs eval only in development.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline styles stay allowed (without a nonce, which would make browsers ignore 'unsafe-inline'): React's style=""
    // attributes cannot carry one, and the toast library adds its stylesheet at run time without one. Styles cannot
    // run code, so scripts are where the protection matters.
    "style-src 'self' 'unsafe-inline'",
    // Customers' logos and thumbnails, avatars and the video files live on storage and CDN hosts we cannot list
    "img-src 'self' blob: data: https:",
    // data: is the silent audio the Remotion preview player attaches to its video element
    "media-src 'self' blob: data: https:",
    "font-src 'self' data:",
    `connect-src 'self'${storage ? ` ${storage}` : ""}`,
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "report-uri /api/csp-report",
  ];
  return directives.join("; ");
}
