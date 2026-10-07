import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { apiError, notFound, forbidden, validationError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, webhookEndpoints } from "@/lib/db/schema";
import { createWebhookEndpointSchema } from "@/lib/validations/webhooks";
import { UnsafeUrlError, assertPublicUrl } from "@/lib/security/ssrf";
import { log } from "@/lib/log";

interface RouteParams {
  params: Promise<{ id: string }>;
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
 * GET /api/spaces/[id]/webhooks
 * List configured webhook endpoints for the space.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;
  const auth = await verifySpaceOwner(id, session.user.id);
  if (auth.error) return auth.error;

  try {
    const endpoints = await db
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        format: webhookEndpoints.format,
        isActive: webhookEndpoints.isActive,
        createdAt: webhookEndpoints.createdAt,
      })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.spaceId, id))
      .orderBy(desc(webhookEndpoints.createdAt));

    return NextResponse.json({ webhooks: endpoints });
  } catch (error) {
    log.error("Failed to fetch webhooks:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch webhooks");
  }
}

/**
 * POST /api/spaces/[id]/webhooks
 * Register a new webhook endpoint.
 * Returns the signing secret ONCE in this response.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) {
    return apiError(401, "UNAUTHORIZED", "Unauthorized");
  }

  const { id } = await params;
  const auth = await verifySpaceOwner(id, session.user.id);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const validated = createWebhookEndpointSchema.safeParse(body);
    if (!validated.success) {
      return validationError("Validation failed", validated.error.flatten().fieldErrors);
    }

    try {
      await assertPublicUrl(validated.data.url);
    } catch (err) {
      if (err instanceof UnsafeUrlError) return validationError("Validation failed", { url: [err.message] });
      throw err;
    }

    const secret = `whsec_${randomBytes(24).toString("hex")}`;

    const [newEndpoint] = await db
      .insert(webhookEndpoints)
      .values({
        spaceId: id,
        url: validated.data.url,
        secret,
        events: validated.data.events,
        format: validated.data.format,
        isActive: true,
      })
      .returning({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        format: webhookEndpoints.format,
        isActive: webhookEndpoints.isActive,
        createdAt: webhookEndpoints.createdAt,
      });

    return NextResponse.json(
      {
        webhook: {
          ...newEndpoint,
          secret, // Returned once!
        },
      },
      { status: 201 }
    );
  } catch (error) {
    log.error("Failed to create webhook endpoint:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to create webhook endpoint");
  }
}
