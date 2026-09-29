import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq, desc, count } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { spaces, widgetConfigs, testimonials } from "@/lib/db/schema";
import { createSpaceSchema } from "@/lib/validations/spaces";
import { DEFAULT_WIDGET_CONFIG } from "@/lib/validations/widget-config";

/**
 * GET /api/spaces
 * List all spaces owned by the authenticated user.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch spaces owned by this user
    const userSpaces = await db
      .select({
        id: spaces.id,
        name: spaces.name,
        ownerId: spaces.ownerId,
        embedKey: spaces.embedKey,
        createdAt: spaces.createdAt,
      })
      .from(spaces)
      .where(eq(spaces.ownerId, session.user.id))
      .orderBy(desc(spaces.createdAt));

    // Fetch testimonial count per space
    const spacesWithCounts = await Promise.all(
      userSpaces.map(async (space) => {
        const [testimonialCount] = await db
          .select({ value: count() })
          .from(testimonials)
          .where(eq(testimonials.spaceId, space.id));

        return {
          ...space,
          testimonialCount: testimonialCount?.value ?? 0,
        };
      })
    );

    return NextResponse.json({ spaces: spacesWithCounts });
  } catch (error) {
    console.error("Failed to fetch spaces:", error);
    return NextResponse.json(
      { error: "Failed to fetch spaces" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/spaces
 * Create a new space for the authenticated user.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = createSpaceSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validated.error.flatten().fieldErrors,
        },
        { status: 400 }
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
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create space:", error);
    return NextResponse.json(
      { error: "Failed to create space" },
      { status: 500 }
    );
  }
}
