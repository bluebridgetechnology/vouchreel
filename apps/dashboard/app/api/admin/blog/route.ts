import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import { apiError, internalError, validationError } from "@/lib/api/errors";
import { requirePlatformAdminApi } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import { isDuplicateSlugError, listPostsForAdmin } from "@/lib/blog";
import { blogPostSchema } from "@/lib/validations/blog";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/** GET /api/admin/blog: every post (without its body), drafts and scheduled ones included. */
export async function GET() {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ posts: await listPostsForAdmin() });
  } catch (err) {
    log.error("Failed to list blog posts:", err);
    return internalError("Failed to load the posts");
  }
}

/** POST /api/admin/blog: create a post. A published post with no date goes live now. */
export async function POST(request: Request) {
  const guard = await requirePlatformAdminApi();
  if (!guard.ok) return guard.response;

  const parsed = blogPostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return validationError("Validation failed", parsed.error.flatten().fieldErrors);
  }

  const post = parsed.data;
  try {
    const [row] = await db
      .insert(blogPosts)
      .values({ ...post, publishedAt: post.isPublished ? (post.publishedAt ?? new Date()) : post.publishedAt })
      .returning();

    await logAdminAction({
      actorId: guard.session.user.id,
      action: "blog.created",
      entityType: "blog_post",
      entityId: row.id,
      summary: `Created blog post "${row.title}"${row.isPublished ? " (published)" : " (draft)"}`,
    });
    return NextResponse.json({ post: row }, { status: 201 });
  } catch (err) {
    if (isDuplicateSlugError(err)) {
      return apiError(409, "BAD_REQUEST", "Another post already uses that web address", { details: { slug: ["Already used by another post"] } });
    }
    log.error("Failed to create blog post:", err);
    return internalError("Failed to create the post");
  }
}
