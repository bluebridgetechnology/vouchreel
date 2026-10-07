import { NextResponse } from "next/server";
import { internalError } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { getUsageReport } from "@/lib/admin/usage";

export const dynamic = "force-dynamic";

/** GET /api/admin/usage?month=YYYY-MM&page=1: video credit use per account for a UTC month. Unlimited allowances are returned as null. */
export async function GET(request: Request) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const params = new URL(request.url).searchParams;
  try {
    const report = await getUsageReport(params.get("month") ?? undefined, Number(params.get("page")) || 1);
    return NextResponse.json({
      ...report,
      accounts: report.accounts.map((a) => ({
        ...a,
        reviewLimit: Number.isFinite(a.reviewLimit) ? a.reviewLimit : null,
        aiLimit: Number.isFinite(a.aiLimit) ? a.aiLimit : null,
      })),
    });
  } catch (err) {
    return internalError(err instanceof Error ? err.message : "Failed to load usage");
  }
}
