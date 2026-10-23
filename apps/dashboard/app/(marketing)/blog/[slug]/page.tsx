import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownBody } from "@/components/blog/markdown-body";
import { formatPostDate } from "@/components/blog/post-card";
import { ArrowButton } from "@/components/marketing/arrow-button";
import { FinalCta } from "@/components/marketing/final-cta";
import { Icon } from "@/components/ui/icon";
import { Container } from "@/components/ui/layout";
import { getPublishedPost, readingMinutes } from "@/lib/blog";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug).catch(() => null);
  if (!post) return { title: "Post not found" };
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt ?? undefined,
      publishedTime: post.publishedAt?.toISOString(),
      authors: post.authorName ? [post.authorName] : undefined,
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPublishedPost(slug).catch(() => null);
  if (!post) notFound();

  const meta = [formatPostDate(post.publishedAt), post.authorName, `${readingMinutes(post.content)} min read`].filter(Boolean).join(" · ");

  return (
    <>
      <article>
        <Container className="pb-12 pt-12 sm:pt-16">
          <div className="mx-auto max-w-3xl">
            <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-text-muted transition-colors hover:text-text">
              <Icon name="arrow-left" size="sm" /> All posts
            </Link>
            <h1 className="mt-6 text-4xl font-medium sm:text-6xl">{post.title}</h1>
            <p className="mt-5 text-sm text-text-subtle">{meta}</p>
            {post.excerpt && <p className="mt-5 text-lg text-text-muted">{post.excerpt}</p>}
          </div>

          {post.coverImageUrl && (
            <div className="mx-auto mt-10 max-w-5xl">
              <img src={post.coverImageUrl} alt="" className="aspect-[16/9] w-full rounded-panel border object-cover" />
            </div>
          )}

          <div className="mx-auto mt-12 max-w-3xl">
            <MarkdownBody source={post.content} />

            <div className="mt-16 flex flex-col items-start gap-4 rounded-panel bg-surface-sunken p-8">
              <h2 className="text-2xl font-medium">Collect your first customer videos</h2>
              <p className="text-text-muted">Send one link, embed one script tag, and show the right story on the right page.</p>
              <ArrowButton href="/signup" size="lg">
                Start free
              </ArrowButton>
            </div>
          </div>
        </Container>
      </article>

      <FinalCta />
    </>
  );
}
