import { lookup } from "dns/promises";
import { isIP } from "net";

/**
 * SSRF protection for every server-side fetch of a user-supplied URL (webhooks, oEmbed
 * lookups, social-export sources). It blocks private, loopback, link-local, CGNAT,
 * multicast and reserved ranges for IPv4 and IPv6 (including IPv4-mapped IPv6), resolves
 * hostnames and rejects names that point at them, and re-validates every redirect hop.
 *
 * Residual risk: a hostname can change its DNS answer between our check and the
 * connection (DNS rebinding). Deploy with egress filtering for defence in depth.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

// [network, prefix length]
const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16],
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

function isPrivateV4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return BLOCKED_V4.some(([net, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) === (ipv4ToInt(net) & mask);
  });
}

/** Expands any valid IPv6 text form (::, embedded IPv4) to 16 bytes. */
function ipv6ToBytes(ip: string): number[] | null {
  let text = ip.toLowerCase().split("%")[0];
  const embedded = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (embedded) {
    const v4 = embedded[1].split(".").map(Number);
    const hi = ((v4[0] << 8) | v4[1]).toString(16);
    const lo = ((v4[2] << 8) | v4[3]).toString(16);
    text = text.slice(0, -embedded[1].length) + `${hi}:${lo}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.length !== 8) return null;
  const bytes: number[] = [];
  for (const group of groups) {
    const n = parseInt(group || "0", 16);
    if (Number.isNaN(n) || n > 0xffff) return null;
    bytes.push(n >> 8, n & 0xff);
  }
  return bytes;
}

function isPrivateV6(ip: string): boolean {
  const b = ipv6ToBytes(ip);
  if (!b) return true; // unparseable: fail closed
  const allZeroUntil = (n: number) => b.slice(0, n).every((x) => x === 0);
  if (allZeroUntil(15) && (b[15] === 0 || b[15] === 1)) return true; // :: and ::1
  if (allZeroUntil(10) && b[10] === 0xff && b[11] === 0xff) {
    return isPrivateV4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`); // ::ffff:a.b.c.d
  }
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) {
    return isPrivateV4(`${b[12]}.${b[13]}.${b[14]}.${b[15]}`); // 64:ff9b::/96 NAT64
  }
  if ((b[0] & 0xfe) === 0xfc) return true; // fc00::/7 unique local
  if (b[0] === 0xfe && (b[1] & 0xc0) === 0x80) return true; // fe80::/10 link-local
  if (b[0] === 0xff) return true; // multicast
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x0d && b[3] === 0xb8) return true; // documentation
  return false;
}

/** True for any IP (v4 or v6) that must never be reachable from user-supplied URLs. */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateV4(ip);
  if (version === 6) return isPrivateV6(ip);
  return true;
}

const BLOCKED_NAMES = [/^localhost$/, /\.localhost$/, /\.local$/, /\.internal$/, /\.localdomain$/, /^metadata\.google\.internal$/];

export interface UrlGuardOptions {
  /** Allow plain http. Defaults to true outside production. */
  allowHttp?: boolean;
  /** Injected for tests. */
  resolve?: (hostname: string) => Promise<string[]>;
}

const defaultResolve = async (hostname: string) => (await lookup(hostname, { all: true, verbatim: true })).map((a) => a.address);

/** Escape hatch for local development only (for example webhooks to localhost). Ignored in production. */
function privateTargetsAllowed(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ALLOW_PRIVATE_WEBHOOK_TARGETS === "true";
}

/**
 * Parses and validates a URL for outbound requests. Throws UnsafeUrlError with a
 * user-presentable message. Returns the parsed URL on success.
 */
export async function assertPublicUrl(raw: string, options: UrlGuardOptions = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Enter a valid URL.");
  }

  const allowHttp = options.allowHttp ?? process.env.NODE_ENV !== "production";
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new UnsafeUrlError(allowHttp ? "Only http and https URLs are supported." : "The URL must use https.");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs with embedded credentials are not allowed.");
  }
  if (privateTargetsAllowed()) return url;

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_NAMES.some((re) => re.test(host))) {
    throw new UnsafeUrlError("Internal or private addresses are not allowed.");
  }

  if (isIP(host)) {
    if (isPrivateIp(host)) throw new UnsafeUrlError("Internal or private addresses are not allowed.");
    return url;
  }

  let addresses: string[];
  try {
    addresses = await (options.resolve ?? defaultResolve)(host);
  } catch {
    throw new UnsafeUrlError("The hostname could not be resolved.");
  }
  if (addresses.length === 0 || addresses.some(isPrivateIp)) {
    throw new UnsafeUrlError("The hostname resolves to an internal or private address.");
  }
  return url;
}

export interface SafeFetchOptions extends UrlGuardOptions {
  maxRedirects?: number;
}

/**
 * fetch() for untrusted URLs: validates the target, follows at most `maxRedirects`
 * redirects manually and re-validates each hop (a public host cannot bounce us to
 * 169.254.169.254).
 */
export async function safeFetch(raw: string, init: RequestInit = {}, options: SafeFetchOptions = {}): Promise<Response> {
  let current = raw;
  const limit = options.maxRedirects ?? 3;
  for (let hop = 0; hop <= limit; hop++) {
    const url = await assertPublicUrl(current, options);
    const response = await fetch(url, { ...init, redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, url).toString();
      continue;
    }
    return response;
  }
  throw new UnsafeUrlError("Too many redirects.");
}
