/**
 * Removes personal data and secrets before anything is written to a log or sent to an error tracker.
 * What it protects: email addresses, tokens and keys, cookies, and the words people wrote
 * (testimonials, scripts, reviews, names). Identifiers such as UUIDs are kept, because they are what
 * makes a log line useful.
 */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const AUTH_SCHEME = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const KEYED = /\b(token|secret|password|passwd|api[_-]?key|apikey|authorization|signature|sig|code)=([^&\s"'<>]+)/gi;
const LONG = /[A-Za-z0-9_-]{32,}/g;
const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const MAX_STRING = 2000;
const MAX_ITEMS = 20;
const MAX_DEPTH = 5;

/** Keys whose value is a secret whatever it looks like. */
const SECRET_KEY = /pass(word|wd)?|secret|token|cookie|authorization|api[-_]?key|dsn|signature|credential|session/i;
/** Keys whose value is something a person wrote or their identity. */
const CONTENT_KEY = /^(quote|text|script|scripttrimmed|scriptoriginal|content|body|comment|comments|review|reviewtext|transcript|caption|title|description|customername|customeremail|customercompany|email|name|phone|username|author|authorname|reason)$/i;

export function scrubString(value: string): string {
  const clipped = value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}...[${value.length - MAX_STRING} more characters]` : value;
  return clipped
    .replace(JWT, "[token]")
    .replace(AUTH_SCHEME, "$1 [token]")
    .replace(KEYED, "$1=[redacted]")
    .replace(EMAIL, "[email]")
    // A long run is a token unless it is only ids (a UUID, or a name with one in it like "worker-<uuid>")
    .replace(LONG, (match) => (match.replace(UUID_ANYWHERE, "").match(LONG) ? "[token]" : match));
}

/** Keeps the path (useful) and drops every query value (often tokens or search text). */
export function scrubUrl(url: string): string {
  const q = url.indexOf("?");
  if (q === -1) return scrubString(url);
  const keys = [...new URLSearchParams(url.slice(q + 1)).keys()];
  return `${scrubString(url.slice(0, q))}?${keys.map((k) => `${scrubString(k)}=[removed]`).join("&")}`;
}

export function serializeError(error: Error): { name: string; message: string; stack?: string } {
  return { name: error.name, message: scrubString(error.message), ...(error.stack ? { stack: scrubString(error.stack) } : {}) };
}

/** Scrubs any value: strings by pattern, objects by key and by pattern, errors into a plain shape. */
export function scrubValue(value: unknown, key?: string, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (key && SECRET_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") {
    // Already scrubbed (the logger and the error tracker both scrub): leave it as it is
    if (key && CONTENT_KEY.test(key)) return value.startsWith("[text removed:") ? value : `[text removed: ${value.length} characters]`;
    return scrubString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Error) return serializeError(value);
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return "[too deep]";
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ITEMS).map((v) => scrubValue(v, key, depth + 1));
    return value.length > MAX_ITEMS ? [...items, `[${value.length - MAX_ITEMS} more items]`] : items;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 50)) out[k] = scrubValue(v, k, depth + 1);
    return out;
  }
  return `[${typeof value}]`;
}

/* ---- Sentry events ---- */

// Loose on purpose: the exact event type belongs to the SDK, and this only touches fields by name
type SentryLike = Record<string, any>;

const KEPT_HEADERS = new Set(["content-type", "user-agent", "accept", "accept-language"]);

/**
 * `beforeSend` for the error tracker: removes personal data from an event, keeping what is needed to
 * find the bug (message, stack, route, ids).
 */
export function scrubSentryEvent<T extends SentryLike>(event: T): T {
  const e = event as SentryLike;
  if (typeof e.message === "string") e.message = scrubString(e.message);
  if (e.logentry && typeof e.logentry.message === "string") e.logentry.message = scrubString(e.logentry.message);

  for (const ex of e.exception?.values ?? []) {
    if (typeof ex.value === "string") ex.value = scrubString(ex.value);
    // Local variable values in stack frames can hold anything
    for (const frame of ex.stacktrace?.frames ?? []) {
      delete frame.vars;
      // The lines of source around the frame can hold literals (an address in a test, a key in a script)
      if (typeof frame.context_line === "string") frame.context_line = scrubString(frame.context_line);
      for (const k of ["pre_context", "post_context"] as const) if (Array.isArray(frame[k])) frame[k] = frame[k].map((l: string) => scrubString(l));
    }
  }

  if (e.request) {
    const req = e.request;
    if (typeof req.url === "string") req.url = scrubUrl(req.url);
    delete req.cookies;
    delete req.data;
    delete req.query_string;
    if (req.headers) {
      req.headers = Object.fromEntries(Object.entries(req.headers as Record<string, string>).filter(([k]) => KEPT_HEADERS.has(k.toLowerCase())));
    }
  }

  // Only the account id: who it happened to is findable in our own database, the rest is personal data
  if (e.user) e.user = e.user.id ? { id: String(e.user.id) } : undefined;

  if (Array.isArray(e.breadcrumbs)) {
    for (const b of e.breadcrumbs) {
      if (typeof b.message === "string") b.message = scrubString(b.message);
      if (b.data) {
        if (typeof b.data.url === "string") b.data.url = scrubUrl(b.data.url);
        b.data = scrubValue(b.data);
      }
    }
  }
  if (e.extra) e.extra = scrubValue(e.extra);
  if (e.tags) e.tags = scrubValue(e.tags);
  return event;
}
