import { NextResponse } from "next/server";
import { and, count, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { collectionForms as collectionFormsTable, spaces, submissions } from "@/lib/db/schema";
import { createCollectionFormSchema } from "@/lib/validations/collection-forms";
import { log } from "@/lib/log";

interface RouteParams { params: Promise<{ id: string }> }

async function verifySpaceOwner(spaceId: string, userId: string) {
  const [space] = await db.select({ id: spaces.id, ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId));
  if (!space) return { error: [404, "NOT_FOUND", "Space not found"] as const };
  if (space.ownerId !== userId) return { error: [403, "FORBIDDEN", "Forbidden: You do not own this space"] as const };
  return { space };
}

export async function GET(_: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Unauthorized");
  const { id } = await params;
  const auth = await verifySpaceOwner(id, session.user.id);
  if (auth.error) return apiError(auth.error[0], auth.error[1], auth.error[2]);
  try {
    const collectionForms = await db.select({
      id: collectionFormsTable.id, spaceId: collectionFormsTable.spaceId, title: collectionFormsTable.title,
      promptText: collectionFormsTable.promptText, incentiveType: collectionFormsTable.incentiveType,
      incentiveValue: collectionFormsTable.incentiveValue, branding: collectionFormsTable.branding, collectModes: collectionFormsTable.collectModes,
      isActive: collectionFormsTable.isActive, slug: collectionFormsTable.slug, createdAt: collectionFormsTable.createdAt,
      pendingSubmissionCount: count(submissions.id),
    }).from(collectionFormsTable).leftJoin(submissions, and(eq(submissions.formId, collectionFormsTable.id), eq(submissions.status, "pending")))
      .where(eq(collectionFormsTable.spaceId, id)).groupBy(collectionFormsTable.id).orderBy(desc(collectionFormsTable.createdAt));
    return NextResponse.json({ collectionForms });
  } catch (error) {
    log.error("Failed to fetch collection forms:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to fetch collection forms");
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Unauthorized");
  const { id } = await params;
  const auth = await verifySpaceOwner(id, session.user.id);
  if (auth.error) return apiError(auth.error[0], auth.error[1], auth.error[2]);
  try {
    const parsed = createCollectionFormSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Validation failed", { details: parsed.error.flatten().fieldErrors });
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const [collectionForm] = await db.insert(collectionFormsTable).values({ ...parsed.data, spaceId: id, slug: nanoid(12) }).returning();
        return NextResponse.json({ collectionForm }, { status: 201 });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("unique")) throw error;
      }
    }
    return apiError(500, "INTERNAL_ERROR", "Unable to generate a unique collection link");
  } catch (error) {
    log.error("Failed to create collection form:", error);
    return apiError(500, "INTERNAL_ERROR", "Failed to create collection form");
  }
}
