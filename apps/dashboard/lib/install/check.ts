import { safeFetch, UnsafeUrlError } from "@/lib/security/ssrf";
import { describeInspection, inspectHtml, type CheckLine, type InspectInput, type PageInspection } from "./inspect";

/** A page's HTML is read up to this much: the script is nearly always in the head or the end of the body. */
export const MAX_PAGE_BYTES = 1_000_000;
const TIMEOUT_MS = 8_000;
const MAX_URL_LENGTH = 2_048;

/** "acme.com/pricing" works as well as "https://acme.com/pricing". Returns null for something that cannot be a URL. */
export function normalizeUrlInput(raw: string): string | null {
  const text = raw.trim();
  if (!text || text.length > MAX_URL_LENGTH || /\s/.test(text)) return null;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
}

export type PageFetch = { ok: true; status: number; html: string; truncated: boolean } | { ok: false; problem: string };

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/** Reads at most `limit` bytes of a response body as text. */
async function readLimited(res: Response, limit: number): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: await res.text(), truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    chunks.push(size > limit ? value.slice(0, value.length - (size - limit)) : value);
    if (size > limit) {
      truncated = true;
      await reader.cancel();
      break;
    }
  }
  const all = new Uint8Array(Math.min(size, limit));
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.length;
  }
  return { text: new TextDecoder("utf-8", { fatal: false }).decode(all), truncated };
}

/**
 * Fetches a page for the check. The address is checked first by safeFetch (no private or internal addresses, every
 * redirect checked again); the answer is read only if it is HTML, only up to MAX_PAGE_BYTES, and is never sent
 * back to the browser: only what we found in it is. Every failure is a sentence the owner can act on.
 */
export async function fetchPage(url: string, fetcher: Fetcher = safeFetch as Fetcher): Promise<PageFetch> {
  let res: Response;
  try {
    res = await fetcher(url, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "VouchreelInstallCheck/1.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof UnsafeUrlError) return { ok: false, problem: error.message };
    const name = (error as { name?: string } | null)?.name;
    if (name === "TimeoutError" || name === "AbortError") return { ok: false, problem: "The page took too long to answer." };
    return { ok: false, problem: "We could not reach that page. Check the address, and that the site is online." };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, problem: "The page would not let us in (it may be behind a login or a bot filter), so we cannot check it. Visit it yourself and look at \"Last seen\"." };
  }
  if (!res.ok) return { ok: false, problem: `The page answered with an error (${res.status}).` };

  const type = res.headers.get("content-type");
  if (type && !/html|xml/i.test(type)) return { ok: false, problem: "That address is not a web page." };

  try {
    const { text, truncated } = await readLimited(res, MAX_PAGE_BYTES);
    return { ok: true, status: res.status, html: text, truncated };
  } catch {
    return { ok: false, problem: "We could not read that page." };
  }
}

export interface InstallCheckResult {
  reachable: boolean;
  /** Why the page could not be checked, when it could not. */
  problem?: string;
  /** What we found, in order, ready to show. */
  lines: CheckLine[];
  page?: PageInspection;
}

export async function runInstallCheck(rawUrl: string, input: InspectInput, fetcher?: Fetcher): Promise<InstallCheckResult> {
  const url = normalizeUrlInput(rawUrl);
  if (!url) return { reachable: false, problem: "Enter the address of a page on your site, like https://yoursite.com/pricing.", lines: [] };

  const fetched = await fetchPage(url, fetcher);
  if (!fetched.ok) return { reachable: false, problem: fetched.problem, lines: [] };

  const page = inspectHtml(fetched.html, input);
  const lines = describeInspection(page, input);
  if (fetched.truncated && !page.scriptFound) lines.push({ ok: null, text: "This page is very large, so we read only the first part of it." });
  return { reachable: true, lines, page };
}
