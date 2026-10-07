import { NextResponse } from "next/server";
import { internalError, unauthorized } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { verifySpaceAccess } from "@/lib/auth/permissions";
import { consentsCsv } from "@/lib/account/consent-csv";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** GET /api/spaces/:id/consents/export: the space's consent records as a CSV download (editors and owners). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");
  const { id } = await params;
  try {
    const access = await verifySpaceAccess(session.user.id, id, "editor");
    if (!access.success) return access.errorResponse;
    return new NextResponse(await consentsCsv(id), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="consent-records.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    log.error("Failed to export consents:", error);
    return internalError("Could not export consent records");
  }
}
