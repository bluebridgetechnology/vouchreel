import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { apiError, forbidden, unauthorized } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, widgetConfigs } from "@/lib/db/schema";
import { createSpaceSchema } from "@/lib/validations/spaces";
import { DEFAULT_WIDGET_CONFIG } from "@/lib/validations/widget-config";
import { getAccessibleSpacesWithCounts } from "@/lib/auth/permissions";
import { canCreateSpace } from "@/lib/payments/subscription";

/**
 * GET /api/spaces
 * List all spaces accessible by the authenticated user (owned + shared team spaces).
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const spacesWithCounts = await getAccessibleSpacesWithCounts(session.user.id);
    return NextResponse.json({ spaces: spacesWithCounts });
  } catch (error) {
    console.error("Failed to fetch spaces:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch spaces");
  }
}

/**
 * POST /api/spaces
 * Create a new space for the authenticated user, enforcing plan limits.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return unauthorized();
  }

  try {
    const body = await request.json();
    const validated = createSpaceSchema.safeParse(body);

    if (!validated.success) {
      return apiError(400, "VALIDATION_ERROR", "Validation failed", {
        details: validated.error.flatten().fieldErrors,
      });
    }

    // 1. Enforce space creation plan limits
    const [spaceCountResult] = await db
      .select({ value: count() })
      .from(spaces)
      .where(eq(spaces.ownerId, session.user.id));

    const currentCount = spaceCountResult?.value ?? 0;
    const allowed = await canCreateSpace(session.user.id, currentCount);
    if (!allowed) {
      return forbidden(
        "Plan limit reached. Upgrade your plan to create more spaces."
      );
    }

    const embedKey = nanoid(12);

    // Insert new space
    const [newSpace] = await db
      .insert(spaces)
      .values({
        name: validated.data.name,
        ownerId: session.user.id,
        embedKey,
      })
      .returning();

    // Create default widget configuration for the space
    await db.insert(widgetConfigs).values({
      spaceId: newSpace.id,
      ...DEFAULT_WIDGET_CONFIG,
    });

    return NextResponse.json(
      {
        space: {
          ...newSpace,
          testimonialCount: 0,
          role: "owner",
          isDirectOwner: true,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create space:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to create space");
  }
}
