import { isIP } from "net";

/**
 * Best-effort client IP for rate limiting and abuse controls.
 *
 * X-Forwarded-For is a list that every proxy APPENDS to, and the client can put anything
 * in front of it. Trusting the first entry (the previous behaviour) lets anyone dodge a
 * rate limit by sending a different fake IP on each request. We instead count from the
 * RIGHT: with N trusted proxies in front of the app, the client address is the Nth entry
 * from the end (the one our own proxy observed).
 *
 * Set TRUSTED_PROXY_HOPS to how many proxies sit in front of the app:
 *   1 (default)  Vercel, or a single nginx/Caddy/load balancer
 *   2            Cloudflare + nginx
 *   0            the app is exposed directly: forwarding headers are ignored
 */
export function getClientIp(headers: Headers): string {
  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "1", 10);
  if (!Number.isFinite(hops) || hops <= 0) return "unknown";

  const forwarded = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const candidate = forwarded && forwarded.length > 0 ? forwarded[Math.max(0, forwarded.length - hops)] : headers.get("x-real-ip")?.trim();

  return candidate && isIP(candidate) ? candidate : "unknown";
}
