"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export interface TestimonialItem {
  id: string;
  spaceId: string;
  videoUrl: string;
  platform: string;
  thumbnailUrl: string | null;
  title: string | null;
  durationSeconds: number | null;
  quote: string | null;
  customerName: string | null;
  customerCompany: string | null;
  tags: string[];
  matchRules: any;
  sortOrder: number;
  isActive: boolean;
  clipStatus: string;
  createdAt: string;
}

interface TestimonialCardProps {
  testimonial: TestimonialItem;
  onEdit: (t: TestimonialItem) => void;
  onDelete: (t: TestimonialItem) => void;
  onToggleActive: (t: TestimonialItem) => void;
  onExportSocial?: (t: TestimonialItem) => void;
  onManageTranslations?: (t: TestimonialItem) => void;
}

export function TestimonialCard({
  testimonial,
  onEdit,
  onDelete,
  onToggleActive,
  onExportSocial,
  onManageTranslations,
}: TestimonialCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: testimonial.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : 1,
  };

  function formatDuration(seconds: number | null) {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  const matchMode = testimonial.matchRules?.mode || "all";
  const urlPatternCount = testimonial.matchRules?.urlPatterns?.length || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex flex-col gap-4 rounded-card border bg-card p-4 shadow-sm transition-all hover:shadow-card sm:flex-row sm:items-start ${
        !testimonial.isActive ? "opacity-75 bg-muted/20" : ""
      }`}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Drag to reorder"
        title="Drag to reorder"
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "cursor-grab self-center sm:self-auto")}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9h.01M8 12h.01M8 15h.01M16 9h.01M16 12h.01M16 15h.01"
          />
        </svg>
      </button>

      {/* Video Thumbnail */}
      <div className="relative aspect-video w-full flex-shrink-0 overflow-hidden rounded-card border bg-muted sm:w-44">
        {testimonial.thumbnailUrl ? (
          <img
            src={testimonial.thumbnailUrl}
            alt={testimonial.title || "Testimonial"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
            No preview
          </div>
        )}

        {/* Platform badge */}
        <span className="absolute left-1.5 top-1.5 rounded-control bg-scrim/75 px-1.5 py-0.5 text-3xs font-medium uppercase tracking-wider text-on-media">
          {testimonial.platform}
        </span>

        {/* Duration badge */}
        {testimonial.durationSeconds && (
          <span className="absolute bottom-1.5 right-1.5 rounded-control bg-scrim/80 px-1.5 py-0.5 font-mono text-2xs text-on-media">
            {formatDuration(testimonial.durationSeconds)}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between space-y-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-medium text-foreground">
              {testimonial.title || "Video Testimonial"}
            </h4>

            {/* Status Badge */}
            <span
              className={`rounded-pill px-2 py-0.5 text-2xs font-medium uppercase tracking-wider ${
                testimonial.isActive
                  ? "bg-success-soft text-success-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {testimonial.isActive ? "Active" : "Inactive"}
            </span>

            {/* AI Auto-Clipping Placeholder Badge */}
            <span className="inline-flex items-center gap-1 rounded-pill bg-brand-soft px-2.5 py-0.5 text-2xs font-medium text-brand">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                />
              </svg>
              Coming soon — AI auto-clipping
            </span>
          </div>

          {/* Customer info */}
          {(testimonial.customerName || testimonial.customerCompany) && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {testimonial.customerName || "Customer"}
              </span>
              {testimonial.customerCompany && (
                <span> • {testimonial.customerCompany}</span>
              )}
            </p>
          )}

          {/* Quote */}
          {testimonial.quote && (
            <p className="line-clamp-2 text-xs italic text-muted-foreground">
              "{testimonial.quote}"
            </p>
          )}

          {/* Tags & Contextual matching */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {/* Contextual match indicator */}
            <span className="inline-flex items-center gap-1 rounded-control bg-muted/60 px-2 py-0.5 text-2xs font-medium text-muted-foreground">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1"
                />
              </svg>
              {matchMode === "all"
                ? "All pages"
                : `${urlPatternCount} specific page rule${urlPatternCount === 1 ? "" : "s"}`}
            </span>

            {/* Tags */}
            {testimonial.tags &&
              testimonial.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-control bg-secondary/80 px-2 py-0.5 text-2xs font-medium text-secondary-foreground"
                >
                  #{tag}
                </span>
              ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between border-t pt-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleActive(testimonial)}
              className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-xs")}
            >
              {testimonial.isActive ? "Disable" : "Enable"}
            </button>
          </div>
          <div className="flex items-center gap-1">
            {testimonial.videoUrl && onExportSocial && (
              <button
                type="button"
                onClick={() => onExportSocial(testimonial)}
                className={buttonVariants({ variant: "ghost-brand", size: "sm" })}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Export for social
              </button>
            )}
            {onManageTranslations && (
              <button
                type="button"
                onClick={() => onManageTranslations(testimonial)}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
                title="Manage multi-language captions & translations"
              >
                <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                Translations
              </button>
            )}
            <button
              type="button"
              onClick={() => onEdit(testimonial)}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(testimonial)}
              className={buttonVariants({ variant: "ghost-danger", size: "sm" })}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
