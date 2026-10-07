import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { apiError, forbidden, notFound } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, webhookEndpoints } from "@/lib/db/schema";
import { sendTestMessage } from "@/lib/webhooks/deliver";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string; webhookId: string }>;
}

/**
 * POST /api/spaces/[id]/webhooks/[webhookId]/test
 * Sends one test message to the endpoint now and reports what it answered. Owner only; 10 a minute.
 */
export async function POST(_: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Unauthorized");
  const { id, webhookId } = await params;

  const [space] = await db.select({ id: spaces.id, name: spaces.name, ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, id));
  if (!space) return notFound("Space not found");
  if (space.ownerId !== session.user.id) return forbidden("Forbidden: You do not own this space");

  const limit = await rateLimit(`webhook_test:${session.user.id}`, { windowMs: 60_000, max: 10 });
  if (!limit.success) return apiError(429, "RATE_LIMITED", "Too many test messages. Wait a minute.");

  const [endpoint] = await db
    .select({ url: webhookEndpoints.url, secret: webhookEndpoints.secret, format: webhookEndpoints.format })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, webhookId), eq(webhookEndpoints.spaceId, id)));
  if (!endpoint) return notFound("Webhook endpoint not found");

  const result = await sendTestMessage(endpoint.url, endpoint.secret, endpoint.format, space.name);
  return NextResponse.json(result);
}
