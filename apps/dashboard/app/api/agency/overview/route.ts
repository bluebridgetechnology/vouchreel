import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { apiError, unauthorized } from "@/lib/api/errors";
import { canAccess } from "@/lib/auth/feature-gate";
import { getAgencyOverview, AgencyQueryOptions } from "@/lib/agency/queries";

/**
 * GET /api/agency/overview
 * Returns multi-space performance metrics and aggregate KPIs for the agency dashboard.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const sortBy = (searchParams.get("sortBy") as AgencyQueryOptions["sortBy"]) || "date";
  const sortOrder = (searchParams.get("sortOrder") as AgencyQueryOptions["sortOrder"]) || "desc";

  const isEntitled = await canAccess(session.user.id, "agency-dashboard");

  try {
    const overview = await getAgencyOverview(session.user.id, {
      search,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      ...overview,
      isEntitled,
    });
  } catch (error) {
    console.error("Failed to load agency overview:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to load agency overview");
  }
}
