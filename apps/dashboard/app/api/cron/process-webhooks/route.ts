import { NextResponse } from "next/server";
import { eq, and, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { webhookDeliveries, webhookEndpoints } from "@/lib/db/schema";
import { attemptDelivery } from "@/lib/webhooks/deliver";
import { authorizeCron } from "@/lib/security/cron-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/process-webhooks
 * Periodic worker that retries failed webhook deliveries scheduled for retry.
 * Can be invoked via Vercel Cron or an external HTTP cron trigger.
 * Protected by CRON_SECRET authorization header.
 */
export async function GET(request: Request) {
  const denied = authorizeCron(request);
  if (denied) return denied;

  try {
    const now = new Date();

    // Query pending/retrying deliveries whose retry timestamp has arrived
    const dueDeliveries = await db
      .select({
        deliveryId: webhookDeliveries.id,
        event: webhookDeliveries.event,
        payload: webhookDeliveries.payload,
        url: webhookEndpoints.url,
        secret: webhookEndpoints.secret,
      })
      .from(webhookDeliveries)
      .innerJoin(
        webhookEndpoints,
        eq(webhookDeliveries.endpointId, webhookEndpoints.id)
      )
      .where(
        and(
          eq(webhookDeliveries.status, "retrying"),
          lte(webhookDeliveries.nextRetryAt, now),
          eq(webhookEndpoints.isActive, true)
        )
      )
      .limit(50);

    const results = await Promise.allSettled(
      dueDeliveries.map((item) =>
        attemptDelivery(
          item.deliveryId,
          item.url,
          item.secret,
          item.event,
          item.payload
        )
      )
    );

    const successCount = results.filter((r) => r.status === "fulfilled").length;

    return NextResponse.json({
      success: true,
      found: dueDeliveries.length,
      processed: successCount,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("Cron failed to process webhooks:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
