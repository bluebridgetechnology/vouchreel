import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";

export type BlogPost = typeof blogPosts.$inferSelect;

/** What the blog list needs of a post: everything but the body. */
const listColumns = {
  id: blogPosts.id,
  slug: blogPosts.slug,
  title: blogPosts.title,
  excerpt: blogPosts.excerpt,
  coverImageUrl: blogPosts.coverImageUrl,
  authorName: blogPosts.authorName,
  publishedAt: blogPosts.publishedAt,
  isPublished: blogPosts.isPublished,
  updatedAt: blogPosts.updatedAt,
};

export type BlogListItem = { [K in keyof typeof listColumns]: BlogPost[K] };

/** A post is on the public blog only while it is published and its date has arrived. */
const isLive = () => and(eq(blogPosts.isPublished, true), lte(blogPosts.publishedAt, new Date()));

/** The published posts, newest first. */
export async function listPublishedPosts(): Promise<BlogListItem[]> {
  return db.select(listColumns).from(blogPosts).where(isLive()).orderBy(desc(blogPosts.publishedAt));
}

/** One published post by its web address; null when it does not exist, is a draft, or is scheduled for later. */
export async function getPublishedPost(slug: string): Promise<BlogPost | null> {
  const [post] = await db.select().from(blogPosts).where(and(eq(blogPosts.slug, slug), isLive())).limit(1);
  return post ?? null;
}

/** Every post, drafts and scheduled ones too, newest edit first, for the admin list. */
export async function listPostsForAdmin(): Promise<BlogListItem[]> {
  return db.select(listColumns).from(blogPosts).orderBy(desc(blogPosts.updatedAt));
}

export async function getPostForAdmin(id: string): Promise<BlogPost | null> {
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  return post ?? null;
}

/** About a minute per 200 words, never less than one. */
export function readingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** True when the database refused a post because another one already has the same web address. */
export function isDuplicateSlugError(err: unknown): boolean {
  const code = (e: unknown) => (e && typeof e === "object" && "code" in e ? (e as { code?: unknown }).code : undefined);
  return code(err) === "23505" || code((err as { cause?: unknown } | null)?.cause) === "23505";
}
