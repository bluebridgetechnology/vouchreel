"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { SpaceListItem } from "@/lib/spaces/queries";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { ModalOverlay } from "@/components/ui/modal";

interface SpacesViewProps {
  initialSpaces: SpaceListItem[];
}

export function SpacesView({ initialSpaces }: SpacesViewProps) {
  const [spaces, setSpaces] = useState<SpaceListItem[]>(initialSpaces);

  // Rename state
  const [editingSpace, setEditingSpace] = useState<SpaceListItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);

  // Delete state
  const [deletingSpace, setDeletingSpace] = useState<SpaceListItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Copy embed key feedback
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const renameTriggerRef = useRef<HTMLButtonElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);

  function closeRenameModal() {
    setEditingSpace(null);
    renameTriggerRef.current?.focus();
  }

  function closeDeleteModal() {
    setDeletingSpace(null);
    deleteTriggerRef.current?.focus();
  }

  useEffect(() => {
    if (!editingSpace && !deletingSpace) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (editingSpace && !renameSaving) {
        setEditingSpace(null);
        renameTriggerRef.current?.focus();
      } else if (deletingSpace && !deleteLoading) {
        setDeletingSpace(null);
        deleteTriggerRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editingSpace, deletingSpace, renameSaving, deleteLoading]);

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
        throw new Error(errorData?.error?.message || "Failed to rename space");
      }

      const { space } = await res.json();
      setSpaces((prev) =>
        prev.map((s) => (s.id === space.id ? { ...s, name: space.name } : s))
      );
      closeRenameModal();
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
        throw new Error(errorData?.error?.message || "Failed to delete space");
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
          <h1 className="text-3xl font-medium tracking-tight">Spaces</h1>
          <p className="text-text-muted text-sm">
            Manage your testimonial spaces and video widgets
          </p>
        </div>
        <Link
          href="/spaces/new"
          className={buttonVariants({ variant: "primary", size: "md" })}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Space
        </Link>
      </div>

      {spaces.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-card border border-dashed p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-pill bg-surface-sunken">
            <svg
              className="h-7 w-7 text-text-muted"
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
          <h3 className="mt-4 text-lg font-medium">No spaces yet</h3>
          <p className="mt-1 max-w-sm text-sm text-text-muted">
            Create your first space to start collecting and displaying video testimonials on your website.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/spaces/new"
              className={buttonVariants({ variant: "primary", size: "md" })}
            >
              Create Space
            </Link>
            <Link
              href="/onboarding"
              className={buttonVariants({ variant: "outline", size: "md" })}
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
              className="flex flex-col justify-between rounded-card border bg-surface p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-card"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xl font-medium tracking-tight text-text">
                    {space.name}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        renameTriggerRef.current = e.currentTarget;
                        setEditingSpace(space);
                        setRenameValue(space.name);
                      }}
                      title="Rename Space"
                      aria-label={`Rename space ${space.name}`}
                      className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
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
                      onClick={(e) => {
                        deleteTriggerRef.current = e.currentTarget;
                        setDeletingSpace(space);
                      }}
                      title="Delete Space"
                      aria-label={`Delete space ${space.name}`}
                      className={buttonVariants({ variant: "ghost-danger", size: "icon-sm" })}
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
                  <span className="text-xs text-text-muted">Embed Key:</span>
                  <button
                    onClick={() => copyEmbedKey(space.embedKey)}
                    className={cn(buttonVariants({ variant: "soft", size: "sm" }), "h-7 px-2.5 font-mono")}
                    title="Click to copy embed key"
                  >
                    <span>{space.embedKey}</span>
                    {copiedKey === space.embedKey ? (
                      <span className="text-2xs text-success-foreground font-medium">Copied!</span>
                    ) : (
                      <svg className="h-3 w-3 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div className="flex items-center gap-4 pt-1 text-xs text-text-muted">
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
                  {/* Deterministic formatting so SSR and hydration output match */}
                  <span>
                    Created{" "}
                    {new Date(space.createdAt).toLocaleDateString("en-US", {
                      timeZone: "UTC",
                    })}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center gap-2 border-t pt-4">
                <Link
                  href={`/spaces/${space.id}/testimonials`}
                  className={cn(buttonVariants({ variant: "primary", size: "sm" }), "flex-1")}
                >
                  Manage Testimonials
                </Link>
                <Link
                  href={`/spaces/${space.id}/widget`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
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
        <ModalOverlay label="Rename space" onClose={() => setEditingSpace(null)}>
          <div
            className="w-full max-w-md rounded-card border bg-surface p-4 sm:p-6 shadow-float"
          >
            <h2 id="rename-dialog-title" className="text-lg font-medium">
              Rename Space
            </h2>
            <p id="rename-dialog-desc" className="mt-1 text-xs text-text-muted">
              Update the name of this testimonial space.
            </p>
            <form onSubmit={handleRename} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="rename-space-name"
                  className="block text-xs font-medium text-text"
                >
                  Space Name
                </label>
                <input
                  id="rename-space-name"
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className={cn(inputClass, "mt-1 w-full text-sm")}
                  required
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeRenameModal}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renameSaving || !renameValue.trim()}
                  className={buttonVariants({ variant: "primary", size: "sm" })}
                >
                  {renameSaving ? "Saving..." : "Save Name"}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Delete Space Confirmation Modal */}
      {deletingSpace && (
        <ModalOverlay label="Delete space" onClose={() => setDeletingSpace(null)}>
          <div
            className="w-full max-w-md rounded-card border bg-surface p-4 sm:p-6 shadow-float"
          >
            <h2 id="delete-dialog-title" className="text-lg font-medium text-danger-foreground">
              Delete Space
            </h2>
            <p id="delete-dialog-desc" className="mt-2 text-sm text-text-muted">
              Are you sure you want to delete <span className="font-medium text-text">{deletingSpace.name}</span>? This will permanently delete the space, its testimonials, and its widget configuration.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                autoFocus
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                className={buttonVariants({ variant: "danger", size: "sm" })}
              >
                {deleteLoading ? "Deleting..." : "Delete Space"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
