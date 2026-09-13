"use client";

import { useState } from "react";
import { MatchRules } from "@/lib/validations/testimonials";
import { MatchRulesEditor } from "./match-rules-editor";

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
        throw new Error(data.error || "Failed to update testimonial");
      }

      onSuccess(data.testimonial);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update testimonial");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div className="relative my-8 w-full max-w-2xl rounded-xl border bg-card p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight">Edit Testimonial</h2>
          <p className="text-xs text-muted-foreground">
            Update metadata, customer details, status, and contextual page matching.
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Active status switch */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div>
              <span className="text-xs font-semibold text-foreground">Active Status</span>
              <p className="text-[11px] text-muted-foreground">
                When active, this testimonial is eligible to display in the website widget.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isActive ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Customer Name & Company */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Customer Company / Role
              </label>
              <input
                type="text"
                value={customerCompany}
                onChange={(e) => setCustomerCompany(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Quote */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Quote / Highlight Soundbite
            </label>
            <textarea
              rows={2}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">
              Tags
            </label>
            <div className="flex gap-2">
              <input
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
                className="flex-1 rounded-md border bg-background px-3 py-1.5 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              >
                Add Tag
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-secondary-foreground"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-muted-foreground hover:text-destructive"
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
              className="rounded-md border bg-background px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
