import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { getPaymentProvider, createPaymentProvider } from "@/lib/payments";
import { unauthorized, badRequest, internalError } from "@/lib/api/errors";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getSession();

    if (!session?.user) {
      return unauthorized("Authentication required");
    }

    const userSub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, session.user.id),
    });

    if (!userSub || !userSub.providerCustomerId) {
      return badRequest(
        "No active paid subscription found for customer portal. Please subscribe first."
      );
    }

    // Determine provider: use stored provider on subscription, or fallback to active provider
    const provider = userSub.provider
      ? createPaymentProvider(userSub.provider)
      : await getPaymentProvider();

    const portalSession = await provider.createCustomerPortalSession(
      userSub.providerCustomerId
    );

    return NextResponse.json({ url: portalSession.url });
  } catch (err) {
    log.error("Customer portal error:", err);
    const message = err instanceof Error ? err.message : "Failed to create portal session";
    return internalError(message);
  }
}
