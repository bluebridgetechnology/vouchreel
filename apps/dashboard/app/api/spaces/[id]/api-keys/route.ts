import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { apiError, notFound, forbidden, validationError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, apiKeys } from "@/lib/db/schema";
import { generateApiKey } from "@/lib/api/api-keys";
import { createApiKeySchema } from "@/lib/validations/api-keys";
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
 * GET /api/spaces/[id]/api-keys
 * List active & historical API keys for a space.
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
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        lastUsedAt: apiKeys.lastUsedAt,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.spaceId, id))
      .orderBy(desc(apiKeys.createdAt));

    return NextResponse.json({ apiKeys: keys });
  } catch (error) {
    log.error("Failed to fetch API keys:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch API keys");
  }
}

/**
 * POST /api/spaces/[id]/api-keys
 * Create a new API key for the space. The raw key is returned ONLY once in this response.
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
    const validated = createApiKeySchema.safeParse(body);
    if (!validated.success) {
      return validationError("Validation failed", validated.error.flatten().fieldErrors);
    }

    const { rawKey, keyHash, keyPrefix } = generateApiKey();

    const [newKey] = await db
      .insert(apiKeys)
      .values({
        spaceId: id,
        name: validated.data.name,
        keyHash,
        keyPrefix,
        isActive: true,
      })
      .returning({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
      });

    return NextResponse.json(
      {
        apiKey: {
          ...newKey,
          rawKey, // Returned once!
        },
      },
      { status: 201 }
    );
  } catch (error) {
    log.error("Failed to create API key:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to create API key");
  }
}
