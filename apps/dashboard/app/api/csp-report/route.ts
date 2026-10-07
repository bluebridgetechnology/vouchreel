import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security/client-ip";
import { scrubUrl } from "@/lib/observability/scrub";
import { log } from "@/lib/log";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024;

const text = (value: unknown, max = 200) => (typeof value === "string" ? value.slice(0, max) : undefined);
/** A URL with its query dropped; keywords such as "inline" and "eval" kept as they are. */
const where = (value: unknown) => {
  const v = text(value, 500);
  return v && /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? scrubUrl(v) : v;
};

/**
 * POST /api/csp-report
 * Where browsers send Content Security Policy violations (the legacy `application/csp-report` shape and the
 * Reporting API's `application/reports+json`). Each one is written to the log, so it can be found in the log
 * stack (B8) and fixed before the policy is enforced. Always answers 204: it must never be an error source.
 */
export async function POST(request: Request) {
  const limit = await rateLimit(`csp_report_${getClientIp(request.headers)}`, { windowMs: 60_000, max: 60 });
  if (!limit.success) return new Response(null, { status: 204 });

  try {
    const raw = await request.text();
    if (raw.length > MAX_BYTES) return new Response(null, { status: 204 });
    const parsed = JSON.parse(raw) as unknown;
    const reports = Array.isArray(parsed) ? parsed.map((r) => (r as { body?: unknown }).body) : [(parsed as { "csp-report"?: unknown })["csp-report"]];
    for (const r of reports.slice(0, 5)) {
      if (!r || typeof r !== "object") continue;
      const report = r as Record<string, unknown>;
      log.warn("[csp] violation", {
        directive: text(report["effective-directive"] ?? report.effectiveDirective ?? report["violated-directive"]),
        blocked: where(report["blocked-uri"] ?? report.blockedURL),
        page: where(report["document-uri"] ?? report.documentURL),
        source: where(report["source-file"] ?? report.sourceFile),
        line: typeof (report["line-number"] ?? report.lineNumber) === "number" ? (report["line-number"] ?? report.lineNumber) : undefined,
        disposition: text(report.disposition),
      });
    }
  } catch {
    // Not JSON or not a report: nothing to record
  }
  return new Response(null, { status: 204 });
}
