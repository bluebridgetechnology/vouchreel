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
import { AiVideoModal } from "@/components/ai-video/ai-video-modal";
import { TranslationsModal } from "@/components/testimonials/translations-modal";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal";
import { notify } from "@/lib/notify";
import { Card } from "@/components/ui/card";

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
  const [aiVideoTestimonial, setAiVideoTestimonial] = useState<TestimonialItem | null>(null);
  const [translatingTestimonial, setTranslatingTestimonial] = useState<TestimonialItem | null>(null);
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
      notify.success(newStatus ? "Testimonial enabled" : "Testimonial disabled");
    } catch (err) {
      notify.fromError(err, "Failed to update status");
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
      notify.success("Testimonial deleted");
    } catch (err) {
      notify.fromError(err, "Failed to delete testimonial");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-medium tracking-tight text-text">
            Testimonials
          </h2>
          <p className="text-xs text-text-muted">
            Drag and drop to reorder how testimonials display in your widget.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/api/spaces/${spaceId}/consents/export`}
          download
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Consent records (CSV)
        </a>
        <button
          type="button"
          onClick={openAddDialog}
          className={buttonVariants({ variant: "primary", size: "sm" })}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Testimonial
        </button>
        </div>
      </div>

      {error && (
        <div className="rounded-control bg-danger-soft p-4 text-xs text-danger-foreground">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-card border bg-surface-sunken/40 p-4"
            />
          ))}
        </div>
      ) : testimonials.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-card border border-dashed p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-pill bg-surface-sunken">
            <svg
              className="h-6 w-6 text-text-muted"
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
          <h3 className="mt-4 text-base font-medium">No testimonials yet</h3>
          <p className="mt-1 max-w-sm text-xs text-text-muted">
            Paste a YouTube, Vimeo, or MP4 link to add your first customer testimonial.
          </p>
          <button
            type="button"
            onClick={openAddDialog}
            className={cn(buttonVariants({ variant: "primary", size: "sm" }), "mt-6")}
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
                  onGenerateVideo={(t) => setAiVideoTestimonial(t)}
                  onManageTranslations={(t) => setTranslatingTestimonial(t)}
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

      {/* AI video from a written testimonial */}
      {aiVideoTestimonial && (
        <AiVideoModal
          spaceId={spaceId}
          testimonial={aiVideoTestimonial}
          onClose={() => setAiVideoTestimonial(null)}
        />
      )}

      {/* Multi-Language Captions & Translations Modal */}
      {translatingTestimonial && (
        <TranslationsModal
          spaceId={spaceId}
          testimonial={translatingTestimonial}
          isOpen={true}
          onClose={() => setTranslatingTestimonial(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingTestimonial && (
        <ModalOverlay label="Delete testimonial" onClose={() => setDeletingTestimonial(null)}>
          <Card variant="flat" className="w-full max-w-md p-4 sm:p-6 shadow-float">
            <h3
              id="delete-testimonial-title"
              className="text-lg font-medium text-danger-foreground"
            >
              Delete Testimonial
            </h3>
            <p
              id="delete-testimonial-desc"
              className="mt-2 text-xs text-text-muted"
            >
              This permanently deletes the testimonial and its video files, including any social exports and AI videos made from it. It cannot be undone. To hide it from your widget without deleting it, use Disable instead.
            </p>
            {deletingTestimonial.title && (
              <p className="mt-2 rounded-control bg-surface-sunken p-2 font-medium text-xs text-text">
                {deletingTestimonial.title}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteDialog}
                autoFocus
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Cancel
              </button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={deleteLoading}
                variant="danger" size="sm" loading={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Delete Testimonial"}
              </Button>
            </div>
          </Card>
        </ModalOverlay>
      )}
    </div>
  );
}
