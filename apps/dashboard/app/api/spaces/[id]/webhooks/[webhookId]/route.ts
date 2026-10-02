import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { apiError, notFound, forbidden, validationError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, webhookEndpoints } from "@/lib/db/schema";
import { updateWebhookEndpointSchema } from "@/lib/validations/webhooks";
import { UnsafeUrlError, assertPublicUrl } from "@/lib/security/ssrf";

interface RouteParams {
  params: Promise<{ id: string; webhookId: string }>;
}

async function verifySpaceOwner(spaceId: string, userId: string) {
  const [space] = await db
    .select({ id: spaces.id, ownerId: spaces.ownerId })
    .from(spaces)
    .where(eq(spaces.id, spaceId));

  if (!space) {
    return { error: notFound("Space not found") };
  }

  if (space.ownerId !== userId) {
    return { error: forbidden("Forbidden: You do not own this space") };
  }

  return { space };
}

/**
 * GET /api/spaces/[id]/webhooks/[webhookId]
 * Get details for a specific webhook endpoint.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id, webhookId } = await params;
  const auth = await verifySpaceOwner(id, session.user.id);
  if (auth.error) return auth.error;

  try {
    const [endpoint] = await db
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        isActive: webhookEndpoints.isActive,
        createdAt: webhookEndpoints.createdAt,
      })
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

    return NextResponse.json({ webhook: endpoint });
  } catch (error) {
    console.error("Failed to fetch webhook:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch webhook");
  }
}

/**
 * PATCH /api/spaces/[id]/webhooks/[webhookId]
 * Update a webhook endpoint's url, subscribed events, or active status.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id, webhookId } = await params;
  const auth = await verifySpaceOwner(id, session.user.id);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const validated = updateWebhookEndpointSchema.safeParse(body);
    if (!validated.success) {
      return validationError("Validation failed", validated.error.flatten().fieldErrors);
    }

    if (validated.data.url) {
      try {
        await assertPublicUrl(validated.data.url);
      } catch (err) {
        if (err instanceof UnsafeUrlError) return validationError("Validation failed", { url: [err.message] });
        throw err;
      }
    }

    const [updated] = await db
      .update(webhookEndpoints)
      .set(validated.data)
      .where(
        and(
          eq(webhookEndpoints.id, webhookId),
          eq(webhookEndpoints.spaceId, id)
        )
      )
      .returning({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        isActive: webhookEndpoints.isActive,
        createdAt: webhookEndpoints.createdAt,
      });

    if (!updated) {
      return notFound("Webhook endpoint not found");
    }

    return NextResponse.json({ webhook: updated });
  } catch (error) {
    console.error("Failed to update webhook:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to update webhook");
  }
}

/**
 * DELETE /api/spaces/[id]/webhooks/[webhookId]
 * Delete a webhook endpoint and its delivery logs.
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id, webhookId } = await params;
  const auth = await verifySpaceOwner(id, session.user.id);
  if (auth.error) return auth.error;

  try {
    const [deleted] = await db
      .delete(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, webhookId),
          eq(webhookEndpoints.spaceId, id)
        )
      )
      .returning({ id: webhookEndpoints.id });

    if (!deleted) {
      return notFound("Webhook endpoint not found");
    }

    return NextResponse.json({ success: true, id: deleted.id });
  } catch (error) {
    console.error("Failed to delete webhook:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to delete webhook");
  }
}
