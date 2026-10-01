"use client";

import { use, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import {
  TestimonialCard,
  TestimonialItem,
} from "@/components/testimonials/testimonial-card";
import { AddTestimonialDialog } from "@/components/testimonials/add-testimonial-dialog";
import { EditTestimonialDialog } from "@/components/testimonials/edit-testimonial-dialog";
import { SocialExportModal } from "@/components/social/social-export-modal";

interface TestimonialsPageProps {
  params: Promise<{ id: string }>;
}

export default function TestimonialsPage({ params }: TestimonialsPageProps) {
  const { id: spaceId } = use(params);

  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<TestimonialItem | null>(null);
  const [deletingTestimonial, setDeletingTestimonial] = useState<TestimonialItem | null>(null);
  const [exportingTestimonial, setExportingTestimonial] = useState<TestimonialItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  function captureFocus() {
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
  }

  function openAddDialog() {
    captureFocus();
    setIsAddOpen(true);
  }

  function closeAddDialog() {
    setIsAddOpen(false);
    lastFocusedRef.current?.focus();
  }

  function openEditDialog(t: TestimonialItem) {
    captureFocus();
    setEditingTestimonial(t);
  }

  function closeEditDialog() {
    setEditingTestimonial(null);
    lastFocusedRef.current?.focus();
  }

  function openDeleteDialog(t: TestimonialItem) {
    captureFocus();
    setDeletingTestimonial(t);
  }

  function closeDeleteDialog() {
    setDeletingTestimonial(null);
    lastFocusedRef.current?.focus();
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function fetchTestimonials() {
    try {
      setLoading(true);
      const res = await fetch(`/api/spaces/${spaceId}/testimonials?includeInactive=true`);
      if (!res.ok) {
        throw new Error("Failed to load testimonials");
      }
      const data = await res.json();
      setTestimonials(data.testimonials || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load testimonials");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTestimonials();
  }, [spaceId]);

  useEffect(() => {
    if (!deletingTestimonial) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleteLoading) {
        setDeletingTestimonial(null);
        lastFocusedRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deletingTestimonial, deleteLoading]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = testimonials.findIndex((t) => t.id === active.id);
    const newIndex = testimonials.findIndex((t) => t.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newItems = arrayMove(testimonials, oldIndex, newIndex);
    const reorderedWithSortOrder = newItems.map((item, index) => ({
      ...item,
      sortOrder: index,
    }));

    // Optimistic UI update
    setTestimonials(reorderedWithSortOrder);

    // Persist reorder to API
    try {
      const payload = reorderedWithSortOrder.map((item) => ({
        id: item.id,
        sortOrder: item.sortOrder,
      }));

      const res = await fetch(`/api/spaces/${spaceId}/testimonials/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });

      if (!res.ok) {
        throw new Error("Failed to persist reorder");
      }
    } catch (err) {
      console.error("Reorder error:", err);
      // Revert if error
      fetchTestimonials();
    }
  }

  async function handleToggleActive(item: TestimonialItem) {
    const newStatus = !item.isActive;
    try {
      const res = await fetch(`/api/spaces/${spaceId}/testimonials/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus }),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      setTestimonials((prev) =>
        prev.map((t) => (t.id === item.id ? { ...t, isActive: newStatus } : t))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  async function handleDelete() {
    if (!deletingTestimonial) return;

    setDeleteLoading(true);
    try {
      const res = await fetch(
        `/api/spaces/${spaceId}/testimonials/${deletingTestimonial.id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        throw new Error("Failed to delete testimonial");
      }

      setTestimonials((prev) =>
        prev.filter((t) => t.id !== deletingTestimonial.id)
      );
      closeDeleteDialog();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete testimonial");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Testimonials
          </h2>
          <p className="text-xs text-muted-foreground">
            Drag and drop to reorder how testimonials display in your widget.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddDialog}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Testimonial
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-4 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border bg-muted/40 p-4"
            />
          ))}
        </div>
      ) : testimonials.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <svg
              className="h-6 w-6 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-semibold">No testimonials yet</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Paste a YouTube, Vimeo, or MP4 link to add your first customer testimonial.
          </p>
          <button
            type="button"
            onClick={openAddDialog}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90"
          >
            Add your first testimonial
          </button>
        </div>
      ) : (
        /* Sortable Testimonial List */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={testimonials.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {testimonials.map((testimonial) => (
                <TestimonialCard
                  key={testimonial.id}
                  testimonial={testimonial}
                  onEdit={openEditDialog}
                  onDelete={openDeleteDialog}
                  onToggleActive={handleToggleActive}
                  onExportSocial={(t) => setExportingTestimonial(t)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Add Testimonial Dialog */}
      <AddTestimonialDialog
        spaceId={spaceId}
        isOpen={isAddOpen}
        onClose={closeAddDialog}
        onSuccess={(newTestimonial) => {
          setTestimonials((prev) => [...prev, newTestimonial]);
        }}
      />

      {/* Edit Testimonial Dialog */}
      {editingTestimonial && (
        <EditTestimonialDialog
          spaceId={spaceId}
          testimonial={editingTestimonial}
          isOpen={true}
          onClose={closeEditDialog}
          onSuccess={(updated) => {
            setTestimonials((prev) =>
              prev.map((t) => (t.id === updated.id ? updated : t))
            );
          }}
        />
      )}

      {/* Social Export Modal */}
      {exportingTestimonial && (
        <SocialExportModal
          spaceId={spaceId}
          testimonial={exportingTestimonial}
          isOpen={true}
          onClose={() => setExportingTestimonial(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingTestimonial && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-testimonial-title"
          aria-describedby="delete-testimonial-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-xl">
            <h3
              id="delete-testimonial-title"
              className="text-lg font-bold text-destructive"
            >
              Delete Testimonial
            </h3>
            <p
              id="delete-testimonial-desc"
              className="mt-2 text-xs text-muted-foreground"
            >
              Are you sure you want to delete this testimonial? It will no longer be displayed in your website widget.
            </p>
            {deletingTestimonial.title && (
              <p className="mt-2 rounded-md bg-muted p-2 font-medium text-xs text-foreground">
                {deletingTestimonial.title}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteDialog}
                autoFocus
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
                {deleteLoading ? "Deleting..." : "Delete Testimonial"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
