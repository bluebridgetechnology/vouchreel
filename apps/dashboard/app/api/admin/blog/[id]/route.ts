import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import { apiError, internalError, notFound, validationError } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { diffFields, logAdminAction } from "@/lib/admin/audit";
import { getPostForAdmin, isDuplicateSlugError } from "@/lib/blog";
import { blogPostSchema } from "@/lib/validations/blog";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/admin/blog/:id: one post with its body. */
export async function GET(_request: Request, { params }: RouteParams) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!UUID.test(id)) return notFound("Post not found");
  const post = await getPostForAdmin(id).catch(() => null);
  if (!post) return notFound("Post not found");
  return NextResponse.json({ post });
}

/**
 * PUT /api/admin/blog/:id
 * Saves the whole post. Publishing without a date goes live now; a post that was already live keeps its original date.
 */
export async function PUT(request: Request, { params }: RouteParams) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!UUID.test(id)) return notFound("Post not found");

  const parsed = blogPostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return validationError("Validation failed", parsed.error.flatten().fieldErrors);
  }
  const post = parsed.data;

  try {
    const before = await getPostForAdmin(id);
    if (!before) return notFound("Post not found");

    const publishedAt = post.isPublished ? (post.publishedAt ?? before.publishedAt ?? new Date()) : post.publishedAt;
    const [row] = await db
      .update(blogPosts)
      .set({ ...post, publishedAt, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();

    // The body can be long; the audit trail only needs to know that it changed
    const { content: oldContent, ...beforeRest } = before;
    const { content: newContent, ...afterRest } = row;
    const changes = diffFields(beforeRest as unknown as Record<string, unknown>, afterRest as unknown as Record<string, unknown>);
    delete changes.updatedAt;
    if (oldContent !== newContent) changes.content = { from: `${oldContent.length} characters`, to: `${newContent.length} characters` };

    await logAdminAction({
      actorId: guard.session.user.id,
      action: "blog.updated",
      entityType: "blog_post",
      entityId: id,
      summary: `Updated blog post "${row.title}" (${Object.keys(changes).join(", ") || "no changes"})`,
      changes,
    });
    return NextResponse.json({ post: row });
  } catch (err) {
    if (isDuplicateSlugError(err)) {
      return apiError(409, "BAD_REQUEST", "Another post already uses that web address", { details: { slug: ["Already used by another post"] } });
    }
    log.error("Failed to update blog post:", err);
    return internalError("Failed to save the post");
  }
}

/** DELETE /api/admin/blog/:id: remove a post for good. Unpublish it instead to keep the text. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  if (!UUID.test(id)) return notFound("Post not found");

  try {
    const [row] = await db.delete(blogPosts).where(eq(blogPosts.id, id)).returning({ id: blogPosts.id, title: blogPosts.title });
    if (!row) return notFound("Post not found");
    await logAdminAction({
      actorId: guard.session.user.id,
      action: "blog.deleted",
      entityType: "blog_post",
      entityId: id,
      summary: `Deleted blog post "${row.title}"`,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    log.error("Failed to delete blog post:", err);
    return internalError("Failed to delete the post");
  }
}
