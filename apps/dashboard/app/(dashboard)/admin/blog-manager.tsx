"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MarkdownBody } from "@/components/blog/markdown-body";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/lib/notify";
import { BLOG_CONTENT_MAX, BLOG_EXCERPT_MAX, BLOG_TITLE_MAX, blogPostSchema, slugify } from "@/lib/validations/blog";

/** A post as the list needs it (dates arrive as text from the server). */
export interface BlogRow {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  authorName: string;
  isPublished: boolean;
  /** A `datetime-local` value (the admin's own time), blank for "now". */
  publishedAt: string;
}

const EMPTY: FormState = { title: "", slug: "", excerpt: "", content: "", coverImageUrl: "", authorName: "", isPublished: false, publishedAt: "" };

const MARKDOWN_HINT = "Markdown: # headings, **bold**, [links](https://…), lists, > quotes and ![images](https://…). HTML is not shown.";

type Errors = Partial<Record<keyof FormState, string>>;

/** An ISO time as the value a `datetime-local` input wants: the admin's local time, to the minute. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "No date");

function statusOf(row: BlogRow): { label: string; variant: "success" | "warning" | "neutral" } {
  if (!row.isPublished) return { label: "Draft", variant: "neutral" };
  if (row.publishedAt && new Date(row.publishedAt) > new Date()) return { label: "Scheduled", variant: "warning" };
  return { label: "Published", variant: "success" };
}

/** Admin > Blog: the list of posts, and an editor for writing one (Markdown, with a preview). */
export function BlogManager({ posts }: { posts: BlogRow[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<{ id: string | null } | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const patch = (next: Partial<FormState>) => setForm((f) => ({ ...f, ...next }));

  function startNew() {
    setForm(EMPTY);
    setSlugTouched(false);
    setErrors({});
    setShowPreview(false);
    setEditing({ id: null });
  }

  async function startEdit(row: BlogRow) {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/blog/${row.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || "Could not open the post");
      const p = data.post;
      setForm({
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt ?? "",
        content: p.content ?? "",
        coverImageUrl: p.coverImageUrl ?? "",
        authorName: p.authorName ?? "",
        isPublished: p.isPublished,
        publishedAt: toLocalInput(p.publishedAt),
      });
      setSlugTouched(true);
      setErrors({});
      setShowPreview(false);
      setEditing({ id: row.id });
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Could not open the post");
    } finally {
      setLoading(false);
    }
  }

  /** What the server is sent: the date as a real time, so it does not depend on this browser's zone. */
  const payload = () => ({ ...form, publishedAt: form.publishedAt ? new Date(form.publishedAt).toISOString() : null });

  async function save() {
    const checked = blogPostSchema.safeParse(payload());
    if (!checked.success) {
      const f = checked.error.flatten().fieldErrors as Partial<Record<keyof FormState, string[]>>;
      setErrors(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v?.[0]])) as Errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const creating = editing?.id === null;
      const res = await fetch(creating ? "/api/admin/blog" : `/api/admin/blog/${editing?.id}`, {
        method: creating ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      const data = await res.json();
      if (!res.ok) {
        const slugError = data?.error?.details?.slug?.[0];
        if (slugError) setErrors({ slug: slugError });
        throw new Error(data?.error?.message || "Failed to save the post");
      }
      notify.success(form.isPublished ? "Post saved and published." : "Draft saved.");
      setEditing({ id: data.post.id });
      router.refresh();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error saving the post");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: BlogRow) {
    const ok = await confirm({
      title: "Delete this post?",
      description: `"${row.title}" will be removed for good. To keep the text, unpublish it instead.`,
      confirmLabel: "Delete post",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/admin/blog/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      notify.error("Could not delete the post");
      return;
    }
    notify.success("Post deleted.");
    if (editing?.id === row.id) setEditing(null);
    router.refresh();
  }

  if (editing) {
    const isNew = editing.id === null;
    return (
      <div className="max-w-4xl space-y-6">
        <Button type="button" variant="ghost" size="sm" onClick={() => { setEditing(null); router.refresh(); }}>
          <Icon name="alt-arrow-left" size="sm" /> All posts
        </Button>

        <Card variant="flat" className="space-y-6 p-4 shadow-sm sm:p-6">
          <h2 className="text-xl font-medium">{isNew ? "New post" : "Edit post"}</h2>

          <Field label="Title" htmlFor="post-title" error={errors.title}>
            <Input
              id="post-title"
              value={form.title}
              maxLength={BLOG_TITLE_MAX}
              placeholder="How to ask a customer for a video testimonial"
              onChange={(e) => patch({ title: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })}
            />
          </Field>

          <Field
            label="Web address"
            htmlFor="post-slug"
            error={errors.slug}
            hint={`The post lives at /blog/${form.slug || "your-address"}. Changing it later breaks links that already point here.`}
          >
            <Input id="post-slug" value={form.slug} onChange={(e) => { setSlugTouched(true); patch({ slug: e.target.value }); }} />
          </Field>

          <Field label="Summary" htmlFor="post-excerpt" error={errors.excerpt} hint={`Shown on the blog list and in search results. ${form.excerpt.length} of ${BLOG_EXCERPT_MAX} characters.`}>
            <Textarea id="post-excerpt" rows={2} maxLength={BLOG_EXCERPT_MAX} value={form.excerpt} onChange={(e) => patch({ excerpt: e.target.value })} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cover image" htmlFor="post-cover" error={errors.coverImageUrl} hint="A full https:// address, or a path such as /demo/cover.jpg. Leave blank for none">
              <Input id="post-cover" value={form.coverImageUrl} placeholder="https://" onChange={(e) => patch({ coverImageUrl: e.target.value })} />
            </Field>
            <Field label="Author" htmlFor="post-author" error={errors.authorName}>
              <Input id="post-author" value={form.authorName} placeholder="The Vouchreel team" onChange={(e) => patch({ authorName: e.target.value })} />
            </Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Post</p>
              <div className="flex items-center gap-1 rounded-control bg-surface-sunken p-1" role="group" aria-label="Write or preview">
                {([false, true] as const).map((preview) => (
                  <Button
                    key={String(preview)}
                    type="button"
                    size="sm"
                    variant={showPreview === preview ? "inverse" : "ghost"}
                    aria-pressed={showPreview === preview}
                    onClick={() => setShowPreview(preview)}
                    className="h-7 px-3"
                  >
                    {preview ? "Preview" : "Write"}
                  </Button>
                ))}
              </div>
            </div>
            {showPreview ? (
              <Card variant="flat" className="min-h-64 p-5">
                {form.content.trim() ? <MarkdownBody source={form.content} /> : <p className="text-sm text-text-muted">Nothing to preview yet.</p>}
              </Card>
            ) : (
              <div className="space-y-1.5">
                <Textarea
                  id="post-content"
                  rows={18}
                  maxLength={BLOG_CONTENT_MAX}
                  value={form.content}
                  className="font-mono text-sm"
                  aria-label="Post body"
                  aria-invalid={Boolean(errors.content)}
                  onChange={(e) => patch({ content: e.target.value })}
                />
                {errors.content ? (
                  <p role="alert" className="text-xs text-danger-foreground">
                    {errors.content}
                  </p>
                ) : (
                  <p className="text-xs text-text-muted">{MARKDOWN_HINT}</p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Published" htmlFor="post-published" hint="Off keeps it as a draft, visible only here">
              <Switch id="post-published" checked={form.isPublished} onCheckedChange={(isPublished) => patch({ isPublished })} />
            </Field>
            <Field label="Publish date" htmlFor="post-date" error={errors.publishedAt} hint="Blank means now. A later date holds the post back until then">
              <Input id="post-date" type="datetime-local" value={form.publishedAt} onChange={(e) => patch({ publishedAt: e.target.value })} />
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {!isNew && form.isPublished ? (
              <a href={`/blog/${form.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-brand underline underline-offset-4">
                View on the site
              </a>
            ) : (
              <span />
            )}
            <Button type="button" size="lg" loading={saving} disabled={saving} onClick={save}>
              {saving ? "Saving…" : form.isPublished ? "Save and publish" : "Save draft"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-medium">Blog</h2>
          <p className="mt-1 text-sm text-text-muted">Write posts for /blog. Drafts and scheduled posts are visible only here.</p>
        </div>
        <Button type="button" onClick={startNew}>
          <Icon name="add-circle" size="sm" /> New post
        </Button>
      </div>

      {posts.length === 0 ? (
        <Card variant="flat" className="p-8 text-center text-sm text-text-muted">
          No posts yet. Write the first one.
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((row) => {
              const status = statusOf(row);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="font-medium">{row.title}</p>
                    <p className="text-xs text-text-muted">/blog/{row.slug}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-text-muted">{formatDate(row.publishedAt ?? row.updatedAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" disabled={loading} onClick={() => startEdit(row)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost-danger" onClick={() => remove(row)}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
