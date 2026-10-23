import type { Metadata } from "next";
import Link from "next/link";
import { PostCard } from "@/components/blog/post-card";
import { FinalCta } from "@/components/marketing/final-cta";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Em } from "@/components/ui/em";
import { Icon } from "@/components/ui/icon";
import { Container, Section } from "@/components/ui/layout";
import { listPublishedPosts } from "@/lib/blog";
import { buttonVariants } from "@/components/ui/button";
import { JsonLd } from "@/components/seo/json-ld";
import { blogSchema, breadcrumbSchema, pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Blog",
    description: "Practical ideas on collecting customer video testimonials and putting them to work on your website.",
    path: "/blog",
  }),
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/feed.xml" } },
};

export default async function BlogPage() {
  // A database problem should show an empty blog, not take the page down
  const posts = await listPublishedPosts().catch(() => []);
  const [featured, ...rest] = posts;

  return (
    <>
      <JsonLd data={[breadcrumbSchema([{ name: "Blog", path: "/blog" }]), blogSchema(posts)]} />
      <Section className="pb-8 pt-16 sm:pt-24">
        <Container>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
            <Badge variant="eyebrow">Blog</Badge>
            <h1 className="text-5xl font-medium sm:text-display">
              Ideas for putting <Em>proof</Em> to work
            </h1>
            <p className="max-w-2xl text-lg text-text-muted">Practical writing on collecting customer video testimonials and using them on your site.</p>
          </div>
        </Container>
      </Section>

      <Section className="pt-8">
        <Container>
          {featured ? (
            <div className="space-y-8">
              <PostCard post={featured} featured />
              {rest.length > 0 && (
                <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post) => (
                    <li key={post.id}>
                      <PostCard post={post} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <Card variant="sunken" className="mx-auto flex max-w-xl flex-col items-center gap-4 p-10 text-center">
              <Icon name="clipboard-text" size="xl" className="text-brand" />
              <h2 className="text-2xl font-medium">The first posts are on their way</h2>
              <p className="text-text-muted">Nothing is published yet. In the meantime, see every widget layout running live.</p>
              <Link href="/features" className={cn(buttonVariants({ variant: "outline" }))}>
                See the features <Icon name="arrow-right" size="sm" />
              </Link>
            </Card>
          )}
        </Container>
      </Section>

      <FinalCta />
    </>
  );
}
