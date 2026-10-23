import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import type { BlogListItem } from "@/lib/blog";
import { cn } from "@/lib/utils";

/** "October 23, 2026": a long date that reads the same wherever the visitor is. */
export function formatPostDate(date: Date | null): string {
  return date ? date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }) : "";
}

/** One post on the blog list: its cover picture (or a soft placeholder), title, summary and date. The featured one sits wider. */
export function PostCard({ post, featured = false }: { post: BlogListItem; featured?: boolean }) {
  const meta = [formatPostDate(post.publishedAt), post.authorName].filter(Boolean).join(" · ");
  return (
    <Card interactive className={cn("group h-full overflow-hidden", featured && "grid md:grid-cols-[1.2fr_1fr]")}>
      <Link href={`/blog/${post.slug}`} className="flex h-full flex-col focus-visible:outline-2 focus-visible:outline-ring md:contents">
        <div className={cn("aspect-[16/9] w-full overflow-hidden bg-tint-peach", featured && "md:aspect-auto md:h-full")}>
          {post.coverImageUrl ? (
            <img src={post.coverImageUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="flex size-full items-center justify-center text-tint-foreground">
              <Icon name="videocamera-record" size="xl" className="size-12 opacity-60" />
            </div>
          )}
        </div>
        <div className={cn("flex flex-1 flex-col gap-3 p-6", featured && "justify-center md:p-10")}>
          {meta && <p className="text-xs text-text-subtle">{meta}</p>}
          <h2 className={cn("font-medium", featured ? "text-3xl sm:text-4xl" : "text-xl")}>{post.title}</h2>
          {post.excerpt && <p className="text-sm leading-relaxed text-text-muted">{post.excerpt}</p>}
          <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-brand">
            Read the post <Icon name="arrow-right" size="sm" className="transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </Link>
    </Card>
  );
}
