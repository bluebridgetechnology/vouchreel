"use client";

import { useEffect, useState } from "react";
import { MatchRules } from "@/lib/validations/testimonials";
import { MatchRulesEditor } from "./match-rules-editor";

interface AddTestimonialDialogProps {
  spaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (testimonial: any) => void;
}

export function AddTestimonialDialog({
  spaceId,
  isOpen,
  onClose,
  onSuccess,
}: AddTestimonialDialogProps) {
  const [videoUrl, setVideoUrl] = useState("");
  const [fetchingOembed, setFetchingOembed] = useState(false);
  const [oembedError, setOembedError] = useState<string | null>(null);

  // Auto-fetched metadata
  const [title, setTitle] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [platform, setPlatform] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);

  // User fields
  const [quote, setQuote] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [matchRules, setMatchRules] = useState<MatchRules>({
    mode: "all",
    urlPatterns: [],
    tags: [],
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleFetchMetadata(urlToFetch?: string) {
    const targetUrl = (urlToFetch || videoUrl).trim();
    if (!targetUrl) return;

    setFetchingOembed(true);
    setOembedError(null);

    try {
      const res = await fetch(`/api/oembed?url=${encodeURIComponent(targetUrl)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || "Could not fetch video metadata");
      }

      setTitle(data.title || "");
      setThumbnailUrl(data.thumbnailUrl || null);
      setPlatform(data.platform || null);
      setDurationSeconds(data.durationSeconds || null);
    } catch (err) {
      setOembedError(err instanceof Error ? err.message : "Failed to fetch metadata");
    } finally {
      setFetchingOembed(false);
    }
  }

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
    if (!videoUrl.trim()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/spaces/${spaceId}/testimonials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: videoUrl.trim(),
          title: title.trim() || undefined,
          thumbnailUrl: thumbnailUrl || undefined,
          platform: platform || undefined,
          durationSeconds: durationSeconds ?? undefined,
          quote: quote.trim() || undefined,
          customerName: customerName.trim() || undefined,
          customerCompany: customerCompany.trim() || undefined,
          tags,
          matchRules,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to create testimonial");
      }

      onSuccess(data.testimonial);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create testimonial");
    } finally {
      setSubmitting(false);
    }
  }

  function formatDuration(seconds: number | null) {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-testimonial-title"
        className="relative my-8 w-full max-w-2xl rounded-xl border bg-card p-4 sm:p-6 shadow-2xl"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="space-y-1">
          <h2 id="add-testimonial-title" className="text-xl font-bold tracking-tight">
            Add Video Testimonial
          </h2>
          <p className="text-xs text-muted-foreground">
            Paste a YouTube, Vimeo, or MP4 link. Metadata will be fetched automatically.
          </p>
        </div>

        {submitError && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Video URL Input */}
          <div className="space-y-2">
            <label
              htmlFor="add-video-url"
              className="text-xs font-semibold text-foreground"
            >
              Video URL <span className="text-destructive">*</span>
            </label>
            <div className="flex gap-2">
              <input
                id="add-video-url"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                onBlur={() => {
                  if (videoUrl && !thumbnailUrl) {
                    handleFetchMetadata();
                  }
                }}
                placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                className="flex-1 rounded-md border bg-background px-3 py-2 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => handleFetchMetadata()}
                disabled={fetchingOembed || !videoUrl.trim()}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
              >
                {fetchingOembed ? (
                  <span className="animate-spin text-xs">⟳</span>
                ) : (
                  <span>Fetch</span>
                )}
              </button>
            </div>
            {oembedError && (
              <p className="text-[11px] text-destructive">{oembedError}</p>
            )}
          </div>

          {/* Video Preview Card */}
          {(thumbnailUrl || title || fetchingOembed) && (
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center">
              {thumbnailUrl && (
                <div className="relative aspect-video w-36 flex-shrink-0 overflow-hidden rounded-md border bg-black">
                  <img
                    src={thumbnailUrl}
                    alt={title}
                    className="h-full w-full object-cover"
                  />
                  {durationSeconds && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 font-mono text-[10px] text-white">
                      {formatDuration(durationSeconds)}
                    </span>
                  )}
                  {platform && (
                    <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium uppercase text-white">
                      {platform}
                    </span>
                  )}
                </div>
              )}
              <div className="flex-1 space-y-1">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Testimonial Title"
                  aria-label="Testimonial title"
                  className="w-full rounded border bg-background px-2.5 py-1 text-xs font-semibold focus:border-primary focus:outline-none"
                />
                <p className="text-[11px] text-muted-foreground">
                  Detected platform: <span className="font-medium capitalize text-foreground">{platform || "video"}</span>
                </p>
              </div>
            </div>
          )}

          {/* Customer Name & Company */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="add-customer-name"
                className="text-xs font-semibold text-foreground"
              >
                Customer Name
              </label>
              <input
                id="add-customer-name"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g., Sarah Johnson"
                className="w-full rounded-md border bg-background px-3 py-2 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="add-customer-company"
                className="text-xs font-semibold text-foreground"
              >
                Customer Company / Role
              </label>
              <input
                id="add-customer-company"
                type="text"
                value={customerCompany}
                onChange={(e) => setCustomerCompany(e.target.value)}
                placeholder="e.g., Founder at Acme Corp"
                className="w-full rounded-md border bg-background px-3 py-2 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Quote / Highlight Soundbite */}
          <div className="space-y-1.5">
            <label
              htmlFor="add-quote"
              className="text-xs font-semibold text-foreground"
            >
              Quote / Highlight Soundbite
            </label>
            <textarea
              id="add-quote"
              rows={2}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              placeholder="e.g., 'Vouchreel boosted our landing page conversion by 34% in week one!'"
              className="w-full rounded-md border bg-background px-3 py-2 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label
              htmlFor="add-tag-input"
              className="text-xs font-semibold text-foreground"
            >
              Tags
            </label>
            <div className="flex gap-2">
              <input
                id="add-tag-input"
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
                      aria-label={`Remove tag ${t}`}
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
              disabled={submitting || !videoUrl.trim()}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Add Testimonial"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
