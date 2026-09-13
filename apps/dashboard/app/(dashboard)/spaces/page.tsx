"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface SpaceItem {
  id: string;
  name: string;
  ownerId: string;
  embedKey: string;
  createdAt: string;
  testimonialCount: number;
}

export default function SpacesPage() {
  const router = useRouter();
  const [spaces, setSpaces] = useState<SpaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rename state
  const [editingSpace, setEditingSpace] = useState<SpaceItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);

  // Delete state
  const [deletingSpace, setDeletingSpace] = useState<SpaceItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Copy embed key feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function fetchSpaces() {
    try {
      setLoading(true);
      const res = await fetch("/api/spaces");
      if (!res.ok) {
        throw new Error("Failed to load spaces");
      }
      const data = await res.json();
      setSpaces(data.spaces || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load spaces");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSpaces();
  }, []);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSpace || !renameValue.trim()) return;

    setRenameSaving(true);
    try {
      const res = await fetch(`/api/spaces/${editingSpace.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to rename space");
      }

      const { space } = await res.json();
      setSpaces((prev) =>
        prev.map((s) => (s.id === space.id ? { ...s, name: space.name } : s))
      );
      setEditingSpace(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename space");
    } finally {
      setRenameSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingSpace) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/spaces/${deletingSpace.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete space");
      }

      setSpaces((prev) => prev.filter((s) => s.id !== deletingSpace.id));
      setDeletingSpace(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete space");
    } finally {
      setDeleteLoading(false);
    }
  }

  function copyEmbedKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Spaces</h1>
          <p className="text-muted-foreground text-sm">
            Manage your testimonial spaces and video widgets
          </p>
        </div>
        <Link
          href="/spaces/new"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Space
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-lg border bg-muted/40 p-6"
            />
          ))}
        </div>
      ) : spaces.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <svg
              className="h-7 w-7 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold">No spaces yet</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first space to start collecting and displaying video testimonials on your website.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/spaces/new"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Create Space
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
            >
              Start Onboarding Wizard
            </Link>
          </div>
        </div>
      ) : (
        /* Spaces Grid */
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <div
              key={space.id}
              className="flex flex-col justify-between rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">
                    {space.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingSpace(space);
                        setRenameValue(space.name);
                      }}
                      title="Rename Space"
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeletingSpace(space)}
                      title="Delete Space"
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Embed key pill */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Embed Key:</span>
                  <button
                    onClick={() => copyEmbedKey(space.embedKey)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 font-mono text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    title="Click to copy embed key"
                  >
                    <span>{space.embedKey}</span>
                    {copiedKey === space.embedKey ? (
                      <span className="text-[10px] text-green-600 font-semibold">Copied!</span>
                    ) : (
                      <svg className="h-3 w-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                      />
                    </svg>
                    <span>{space.testimonialCount} testimonials</span>
                  </div>
                  <span>•</span>
                  <span>Created {new Date(space.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center gap-2 border-t pt-4">
                <Link
                  href={`/spaces/${space.id}/testimonials`}
                  className="inline-flex flex-1 items-center justify-center rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  Manage Testimonials
                </Link>
                <Link
                  href={`/spaces/${space.id}/widget`}
                  className="inline-flex items-center justify-center rounded-md border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  Widget
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rename Space Dialog Modal */}
      {editingSpace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Rename Space</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Update the name of this testimonial space.
            </p>
            <form onSubmit={handleRename} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground">
                  Space Name
                </label>
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSpace(null)}
                  className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renameSaving || !renameValue.trim()}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {renameSaving ? "Saving..." : "Save Name"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Space Confirmation Modal */}
      {deletingSpace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-destructive">Delete Space</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete <span className="font-semibold text-foreground">{deletingSpace.name}</span>? This will permanently delete the space, its testimonials, and its widget configuration.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingSpace(null)}
                className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteLoading ? "Deleting..." : "Delete Space"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
