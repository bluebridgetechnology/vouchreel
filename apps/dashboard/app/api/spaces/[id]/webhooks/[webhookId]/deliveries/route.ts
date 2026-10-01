import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { apiError, notFound, forbidden } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, webhookEndpoints, webhookDeliveries } from "@/lib/db/schema";

interface RouteParams {
  params: Promise<{ id: string; webhookId: string }>;
}

/**
 * GET /api/spaces/[id]/webhooks/[webhookId]/deliveries
 * Lists the most recent webhook deliveries for debugging and auditing.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id, webhookId } = await params;

  // Verify space owner
  const [space] = await db
    .select({ id: spaces.id, ownerId: spaces.ownerId })
    .from(spaces)
    .where(eq(spaces.id, id));

  if (!space) {
    return notFound("Space not found");
  }

  if (space.ownerId !== session.user.id) {
    return forbidden("Forbidden: You do not own this space");
  }

  // Verify endpoint belongs to space
  const [endpoint] = await db
    .select({ id: webhookEndpoints.id })
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.id, webhookId),
        eq(webhookEndpoints.spaceId, id)
      )
    );

  if (!endpoint) {
    return notFound("Webhook endpoint not found");
  }

  try {
    const deliveries = await db
      .select({
        id: webhookDeliveries.id,
        event: webhookDeliveries.event,
        status: webhookDeliveries.status,
        httpStatus: webhookDeliveries.httpStatus,
        responseBody: webhookDeliveries.responseBody,
        attemptCount: webhookDeliveries.attemptCount,
        maxAttempts: webhookDeliveries.maxAttempts,
        nextRetryAt: webhookDeliveries.nextRetryAt,
        createdAt: webhookDeliveries.createdAt,
        completedAt: webhookDeliveries.completedAt,
      })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.endpointId, webhookId))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(50);

    return NextResponse.json({ deliveries });
  } catch (error) {
    console.error("Failed to fetch webhook deliveries:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch webhook deliveries");
  }
}
