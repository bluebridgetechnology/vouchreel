import { NextResponse } from "next/server";
import { eq, and, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { webhookDeliveries, webhookEndpoints, spaces } from "@/lib/db/schema";
import { attemptDelivery } from "@/lib/webhooks/deliver";
import { authorizeCron } from "@/lib/security/cron-auth";
import { log } from "@/lib/log";

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
        format: webhookEndpoints.format,
        spaceName: spaces.name,
      })
      .from(webhookDeliveries)
      .innerJoin(
        webhookEndpoints,
        eq(webhookDeliveries.endpointId, webhookEndpoints.id)
      )
      .innerJoin(spaces, eq(webhookEndpoints.spaceId, spaces.id))
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
          item.payload,
          { format: item.format, spaceName: item.spaceName }
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
    log.error("Cron failed to process webhooks:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
