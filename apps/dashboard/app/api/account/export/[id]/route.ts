import { NextResponse } from "next/server";
import { internalError, notFound, unauthorized } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { exportZipFor } from "@/lib/account/export";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** GET /api/account/export/:id: the zip, to the signed-in account that asked for it, until it expires. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return unauthorized("Unauthorized");
  const { id } = await params;
  try {
    const zip = await exportZipFor(session.user.id, id);
    if (!zip) return notFound("This export is not available (it may have expired).");
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="vouchreel-data.zip"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    log.error("Failed to serve data export:", error);
    return internalError("Could not download your data");
  }
}
