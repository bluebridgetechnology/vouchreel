import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { adminSettings } from "@/lib/db/schema";
import { getActivePaymentProviderName } from "@/lib/payments";
import {
  unauthorized,
  forbidden,
  badRequest,
  internalError,
} from "@/lib/api/errors";

export const dynamic = "force-dynamic";

function isAdmin(role?: string | null): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return r === "owner" || r === "admin";
}

/**
 * GET /api/admin/settings
 * Returns current global administrative settings.
 */
export async function GET() {
  try {
    const session = await getSession();

    if (!session?.user) {
      return unauthorized("Unauthorized");
    }

    if (!isAdmin((session.user as any).role)) {
      return forbidden("Forbidden: Admin access required");
    }

    const activeProvider = await getActivePaymentProviderName();

    return NextResponse.json({
      payment_provider: activeProvider,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch admin settings";
    return internalError(msg);
  }
}

/**
 * PUT /api/admin/settings
 * Updates global administrative settings (e.g. active payment provider).
 */
export async function PUT(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user) {
      return unauthorized("Unauthorized");
    }

    if (!isAdmin((session.user as any).role)) {
      return forbidden("Forbidden: Admin access required");
    }

    const body = await request.json();
    const { payment_provider } = body;

    if (
      !payment_provider ||
      (payment_provider !== "stripe" && payment_provider !== "dodo")
    ) {
      return badRequest(
        "Invalid payment_provider. Must be either 'stripe' or 'dodo'."
      );
    }

    // Upsert into admin_settings table
    const existing = await db.query.adminSettings.findFirst({
      where: eq(adminSettings.key, "payment_provider"),
    });

    if (existing) {
      await db
        .update(adminSettings)
        .set({ value: payment_provider })
        .where(eq(adminSettings.key, "payment_provider"));
    } else {
      await db.insert(adminSettings).values({
        key: "payment_provider",
        value: payment_provider,
      });
    }

    return NextResponse.json({
      success: true,
      payment_provider,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update admin settings";
    return internalError(msg);
  }
}
