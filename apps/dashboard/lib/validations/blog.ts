import { z } from "zod";
import { isSafeAnnouncementLink } from "@/lib/validations/announcement";

export const BLOG_TITLE_MAX = 120;
export const BLOG_EXCERPT_MAX = 300;
export const BLOG_CONTENT_MAX = 100_000;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A web address from a title: lower case, words joined by hyphens, accents and symbols dropped. */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Blank means "none"; anything else is trimmed. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const blogPostSchema = z
  .object({
    title: z.string().trim().min(3, "Give the post a title").max(BLOG_TITLE_MAX, `Keep the title to ${BLOG_TITLE_MAX} characters`),
    slug: z
      .string()
      .trim()
      .min(1, "A web address is needed")
      .max(80, "Keep the web address to 80 characters")
      .regex(SLUG_PATTERN, "Use lower-case letters, numbers and hyphens, such as my-first-post"),
    excerpt: optionalText(BLOG_EXCERPT_MAX),
    content: z.string().max(BLOG_CONTENT_MAX, "The post is too long"),
    /** A path on this site or an http(s) address; blank for no picture. */
    coverImageUrl: optionalText(500).refine((v) => v === null || isSafeAnnouncementLink(v), "Use a full https:// address, or a path such as /demo/cover.jpg"),
    authorName: optionalText(80),
    isPublished: z.boolean(),
    /** When it goes live. Blank means now, once it is published. */
    publishedAt: z
      .string()
      .trim()
      .nullish()
      .transform((v, ctx) => {
        if (!v) return null;
        const date = new Date(v);
        if (Number.isNaN(date.getTime())) {
          ctx.addIssue({ code: "custom", message: "That date is not valid" });
          return z.NEVER;
        }
        return date;
      }),
  })
  .superRefine((post, ctx) => {
    if (post.isPublished && !post.content.trim()) {
      ctx.addIssue({ code: "custom", path: ["content"], message: "Write the post before publishing it" });
    }
  });

export type BlogPostInput = z.infer<typeof blogPostSchema>;
