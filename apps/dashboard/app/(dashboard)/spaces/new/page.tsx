"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";

export default function NewSpacePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to create space");
      }

      router.push(`/spaces/${data.space.id}/testimonials`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create space");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 pt-6">
      {/* Breadcrumb / Back link */}
      <div>
        <Link
          href="/spaces"
          className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-xs")}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to Spaces
        </Link>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-medium tracking-tight">Create a new space</h1>
        <p className="text-sm text-muted-foreground">
          Spaces organize your video testimonials for a specific website, product, or landing page.
        </p>
      </div>

      <div className="rounded-card border bg-card p-4 sm:p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-control bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Space Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Marketing Website, SaaS Landing Page"
              className={cn(inputClass, "w-full text-sm")}
              required
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              A unique embed key will be generated automatically for this space.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/spaces"
              className={buttonVariants({ variant: "outline", size: "md" })}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              {loading ? "Creating..." : "Create Space"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
