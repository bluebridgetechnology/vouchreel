import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { AUDIT_EXPORT_LIMIT, listAuditForExport } from "@/lib/admin/queries";
import { internalError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/** The filter menus send "all" for no filter. */
const notAll = (value: string | null) => (value && value !== "all" ? value : undefined);

/** GET /api/admin/audit/export?q=&type=&actor=&from=&to=: the audit log, filtered like the tab, as a CSV download (newest first, at most 10,000 entries). */
export async function GET(request: Request) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const p = new URL(request.url).searchParams;
  const filter = {
    q: p.get("q") || undefined,
    entityType: notAll(p.get("type")),
    actorId: notAll(p.get("actor")),
    from: p.get("from") || undefined,
    to: p.get("to") || undefined,
  };
  try {
    const { rows, total, truncated } = await listAuditForExport(filter);
    await logAdminAction({
      actorId: guard.session.user.id,
      action: "export.audit",
      entityType: "export",
      summary: `Exported ${rows.length} audit log entries`,
      changes: { filter, rows: rows.length, total },
    });
    const body = toCsv(
      ["time_utc", "admin", "action", "entity_type", "entity_id", "summary", "changes"],
      rows.map((r) => [r.createdAt, r.actorEmail ?? "Deleted user", r.action, r.entityType, r.entityId, r.summary, JSON.stringify(r.changes)])
    );
    const res = csvResponse(body, "admin-audit-log.csv");
    if (truncated) res.headers.set("X-Export-Truncated", `first ${AUDIT_EXPORT_LIMIT} of ${total}`);
    return res;
  } catch (err) {
    return internalError(err instanceof Error ? err.message : "Failed to export the audit log");
  }
}
