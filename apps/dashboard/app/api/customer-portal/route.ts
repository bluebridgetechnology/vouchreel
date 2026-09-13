import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { getPaymentProvider, createPaymentProvider } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userSub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, session.user.id),
    });

    if (!userSub || !userSub.providerCustomerId) {
      return NextResponse.json(
        {
          error:
            "No active paid subscription found for customer portal. Please subscribe first.",
        },
        { status: 400 }
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
    console.error("Customer portal error:", err);
    const message = err instanceof Error ? err.message : "Failed to create portal session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
