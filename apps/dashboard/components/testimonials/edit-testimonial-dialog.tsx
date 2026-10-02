"use client";

import { useEffect, useState } from "react";
import { MatchRules } from "@/lib/validations/testimonials";
import { MatchRulesEditor } from "./match-rules-editor";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { inputClass, textareaClass } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ModalOverlay } from "@/components/ui/modal";
import { notify } from "@/lib/notify";

interface EditTestimonialDialogProps {
  spaceId: string;
  testimonial: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: any) => void;
}

export function EditTestimonialDialog({
  spaceId,
  testimonial,
  isOpen,
  onClose,
  onSuccess,
}: EditTestimonialDialogProps) {
  const [title, setTitle] = useState(testimonial.title || "");
  const [quote, setQuote] = useState(testimonial.quote || "");
  const [customerName, setCustomerName] = useState(testimonial.customerName || "");
  const [customerCompany, setCustomerCompany] = useState(testimonial.customerCompany || "");
  const [isActive, setIsActive] = useState<boolean>(testimonial.isActive ?? true);
  const [tags, setTags] = useState<string[]>(testimonial.tags || []);
  const [newTagInput, setNewTagInput] = useState("");
  const [matchRules, setMatchRules] = useState<MatchRules>(
    testimonial.matchRules || {
      mode: "all",
      urlPatterns: [],
      tags: [],
    }
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleAddTag() {
    const trimmed = newTagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTagInput("");
    }
  }

  function handleRemoveTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/spaces/${spaceId}/testimonials/${testimonial.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || undefined,
            quote: quote.trim() || null,
            customerName: customerName.trim() || null,
            customerCompany: customerCompany.trim() || null,
            tags,
            matchRules,
            isActive,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to update testimonial");
      }

      onSuccess(data.testimonial);
      notify.success("Testimonial updated");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update testimonial");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalOverlay label="Edit testimonial" onClose={onClose}>
      <div
        className="relative my-8 w-full max-w-2xl rounded-card border bg-surface p-4 sm:p-6 shadow-float"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "absolute right-4 top-4")}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="space-y-1">
          <h2 id="edit-testimonial-title" className="text-xl font-medium tracking-tight">
            Edit Testimonial
          </h2>
          <p className="text-xs text-text-muted">
            Update metadata, customer details, status, and contextual page matching.
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-control bg-danger-soft p-3 text-xs text-danger-foreground">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Active status switch */}
          <div className="flex items-center justify-between rounded-card border bg-surface-sunken/30 p-3">
            <div>
              <span className="text-xs font-medium text-text">Active Status</span>
              <p className="text-2xs text-text-muted">
                When active, this testimonial is eligible to display in the website widget.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} aria-label="Active status" />
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-testimonial-name"
              className="text-xs font-medium text-text"
            >
              Title
            </label>
            <input
              id="edit-testimonial-name"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(inputClass, "w-full text-xs")}
            />
          </div>

          {/* Customer Name & Company */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="edit-customer-name"
                className="text-xs font-medium text-text"
              >
                Customer Name
              </label>
              <input
                id="edit-customer-name"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={cn(inputClass, "w-full text-xs")}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="edit-customer-company"
                className="text-xs font-medium text-text"
              >
                Customer Company / Role
              </label>
              <input
                id="edit-customer-company"
                type="text"
                value={customerCompany}
                onChange={(e) => setCustomerCompany(e.target.value)}
                className={cn(inputClass, "w-full text-xs")}
              />
            </div>
          </div>

          {/* Quote */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-quote"
              className="text-xs font-medium text-text"
            >
              Quote / Highlight Soundbite
            </label>
            <textarea
              id="edit-quote"
              rows={2}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              className={cn(textareaClass, "w-full text-xs")}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label
              htmlFor="edit-tag-input"
              className="text-xs font-medium text-text"
            >
              Tags
            </label>
            <div className="flex gap-2">
              <input
                id="edit-tag-input"
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Type tag and press Add"
                className={cn(inputClass, "flex-1 text-xs")}
              />
              <button
                type="button"
                onClick={handleAddTag}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Add Tag
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-control bg-surface-sunken px-2.5 py-0.5 text-2xs font-medium text-text"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      aria-label={`Remove tag ${t}`}
                      className={buttonVariants({ variant: "ghost-danger", size: "bare" })}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Contextual Matching Rules */}
          <MatchRulesEditor
            value={matchRules}
            onChange={(rules) => setMatchRules(rules)}
          />

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Cancel
            </button>
            <Button
              type="submit"
              disabled={saving}
              size="sm" loading={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
