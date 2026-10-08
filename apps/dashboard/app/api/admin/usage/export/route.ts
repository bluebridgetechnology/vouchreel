import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { csvResponse } from "@/lib/admin/csv";
import { parseMonth, usageCsv } from "@/lib/admin/usage";
import { internalError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/** GET /api/admin/usage/export?month=YYYY-MM&scope=accounts|spaces: video credit use for a UTC month as a CSV download. */
export async function GET(request: Request) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const p = new URL(request.url).searchParams;
  const scope = p.get("scope") === "spaces" ? "spaces" : "accounts";
  const { month } = parseMonth(p.get("month") ?? undefined);
  try {
    const body = await usageCsv(scope, month);
    await logAdminAction({
      actorId: guard.session.user.id,
      action: "export.usage",
      entityType: "export",
      summary: `Exported ${month} usage by ${scope === "spaces" ? "space" : "account"}`,
      changes: { month, scope },
    });
    return csvResponse(body, `usage-${month}-${scope}.csv`);
  } catch (err) {
    return internalError(err instanceof Error ? err.message : "Failed to export usage");
  }
}
