import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { apiError } from "@/lib/api/errors";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deleteCollectionForm } from "@/lib/spaces/delete";
import { collectionForms, spaces } from "@/lib/db/schema";
import { updateCollectionFormSchema } from "@/lib/validations/collection-forms";

interface RouteParams { params: Promise<{ id: string; formId: string }> }
async function authorize(spaceId: string, formId: string, userId: string) {
  const [space] = await db.select({ ownerId: spaces.ownerId }).from(spaces).where(eq(spaces.id, spaceId));
  if (!space) return [404, "NOT_FOUND", "Space not found"] as const;
  if (space.ownerId !== userId) return [403, "FORBIDDEN", "Forbidden: You do not own this space"] as const;
  const [form] = await db.select({ id: collectionForms.id }).from(collectionForms).where(and(eq(collectionForms.id, formId), eq(collectionForms.spaceId, spaceId)));
  if (!form) return [404, "NOT_FOUND", "Collection form not found"] as const;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSession(); if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Unauthorized");
  const { id, formId } = await params; const error = await authorize(id, formId, session.user.id); if (error) return apiError(error[0], error[1], error[2]);
  try {
    const parsed = updateCollectionFormSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(400, "VALIDATION_ERROR", "Validation failed", { details: parsed.error.flatten().fieldErrors });
    const [collectionForm] = await db.update(collectionForms).set(parsed.data).where(and(eq(collectionForms.id, formId), eq(collectionForms.spaceId, id))).returning();
    return NextResponse.json({ collectionForm });
  } catch (err) { console.error("Failed to update collection form:", err); return apiError(500, "INTERNAL_ERROR", "Failed to update collection form"); }
}

export async function DELETE(_: Request, { params }: RouteParams) {
  const session = await getSession(); if (!session?.user?.id) return apiError(401, "UNAUTHORIZED", "Unauthorized");
  const { id, formId } = await params; const error = await authorize(id, formId, session.user.id); if (error) return apiError(error[0], error[1], error[2]);
  try { const deleted = await deleteCollectionForm(id, formId); if (!deleted) return apiError(404, "NOT_FOUND", "Collection form not found"); return NextResponse.json({ success: true }); }
  catch (err) { console.error("Failed to delete collection form:", err); return apiError(500, "INTERNAL_ERROR", "Failed to delete collection form"); }
}
