"use client";

import { useState } from "react";
import {
  WidgetPosition,
  WidgetTemplate,
  WidgetTheme,
  TriggerType,
} from "@/lib/validations/widget-config";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleStyle } from "@/components/ui/toggle";
import { Switch } from "@/components/ui/switch";
import { ReviewPreviewModal, VideoPreviewModal } from "./preview/preview-modals";
import { CarouselPreview, MasonryPreview, WallOfLovePreview } from "./preview/template-previews";
import { triggerLabel, type ExpandedReview } from "./preview/preview-types";

interface LivePreviewProps {
  template?: WidgetTemplate;
  position: WidgetPosition;
  theme: WidgetTheme;
  triggerType: TriggerType;
  triggerValue: Record<string, unknown>;
  autoplayPreview: boolean;
  onAutoplayChange?: (enabled: boolean) => void;
}

export function LivePreview({
  template = "floating-card",
  position,
  theme,
  triggerType,
  triggerValue,
  autoplayPreview,
  onAutoplayChange,
}: LivePreviewProps) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedReview, setExpandedReview] = useState<ExpandedReview | null>(null);

  const isDark = theme.mode === "dark";

  return (
    <div className="flex flex-col space-y-3">
      {/* Viewport & Controls Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-pill bg-success animate-pulse" />
          <span className="text-xs font-medium text-text">Live Widget Preview</span>
          <span className="hidden rounded-control bg-surface-sunken px-2 py-0.5 text-2xs font-medium text-text-muted sm:inline-block">
            {triggerLabel(triggerType, triggerValue)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 rounded-card border bg-surface-sunken/30 p-1">
          <button
            type="button"
            onClick={() => setViewport("desktop")}
            className={cn("flex items-center gap-1 rounded-control px-2.5 py-1 text-xs font-medium transition-all", toggleStyle("raised", viewport === "desktop"))}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Desktop
          </button>

          <button
            type="button"
            onClick={() => setViewport("mobile")}
            className={cn("flex items-center gap-1 rounded-control px-2.5 py-1 text-xs font-medium transition-all", toggleStyle("raised", viewport === "mobile"))}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Mobile
          </button>
        </div>
      </div>

      {/* Preview Viewport Frame */}
      <div className="flex items-center justify-center rounded-card border bg-surface-sunken/40 p-4 transition-all min-h-[460px]">
        <div
          className={`relative overflow-hidden rounded-card border border-border shadow-float transition-all duration-300 ${
            viewport === "desktop"
              ? "h-[500px] w-full bg-surface"
              : "h-[580px] w-[340px] rounded-[36px] border-[8px] border-border-strong bg-surface shadow-float"
          }`}
        >
          {/* Mobile Speaker / Camera Notch */}
          {viewport === "mobile" && (
            <div className="absolute top-2 left-1/2 z-30 h-3.5 w-24 -translate-x-1/2 rounded-pill bg-text-inverse/10" />
          )}

          {/* Browser / App Header */}
          <div className="flex items-center justify-between border-b bg-surface-sunken/50 px-3 py-2 text-2xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-pill bg-danger" />
              <div className="h-2 w-2 rounded-pill bg-warning" />
              <div className="h-2 w-2 rounded-pill bg-success" />
            </div>
            <div className="rounded-pill bg-canvas/80 px-4 py-0.5 text-2xs text-text-muted font-mono">
              https://yourbrand.com
            </div>
            <div className="w-6" />
          </div>

          {/* Mock Website Canvas */}
          <div className="relative h-[calc(100%-37px)] overflow-y-auto bg-gradient-to-b from-canvas to-surface-sunken/20 p-4 select-none">
            {/* Mock Navigation */}
            <div className="flex items-center justify-between pb-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-control bg-brand-soft flex items-center justify-center font-medium text-2xs text-brand">
                  V
                </div>
                <span className="text-xs font-medium text-text">Acme Corp</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-8 rounded-control bg-surface-sunken" />
                <div className="h-2 w-8 rounded-control bg-surface-sunken" />
                <div className="h-5 rounded-control bg-brand-soft px-2 text-3xs font-medium text-brand flex items-center">
                  Sign In
                </div>
              </div>
            </div>

            {/* Mock Hero Section */}
            <div className="py-8 text-center space-y-2.5">
              <span className="inline-flex rounded-pill bg-brand-soft px-2.5 py-0.5 text-3xs font-medium text-brand">
                ★ 4.9/5 stars from 300+ founders
              </span>
              <h1 className="text-base font-medium tracking-tight text-text sm:text-lg">
                Supercharge Growth with Authentic Video Testimonials
              </h1>
              <p className="mx-auto max-w-xs text-2xs text-text-muted leading-relaxed">
                Collect, embed, and showcase trust-building video proof that drives conversion on any site.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  type="button"
                  className="rounded-control px-3 py-1 text-2xs font-medium text-on-media shadow-xs"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  Start 14-day Free Trial
                </button>
                <button
                  type="button"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Book Demo
                </button>
              </div>
            </div>

            {/* Mock Content Cards or Curated Templates */}
            {template === "wall-of-love" && <WallOfLovePreview primaryColor={theme.primaryColor} onVideo={() => setIsExpanded(true)} onReview={setExpandedReview} />}

            {template === "carousel" && <CarouselPreview primaryColor={theme.primaryColor} onVideo={() => setIsExpanded(true)} onReview={setExpandedReview} />}

            {template === "masonry" && <MasonryPreview onVideo={() => setIsExpanded(true)} onReview={setExpandedReview} />}

            {isExpanded && <VideoPreviewModal viewport={viewport} isDark={isDark} theme={theme} onClose={() => setIsExpanded(false)} />}

            {expandedReview && (
              <ReviewPreviewModal viewport={viewport} isDark={isDark} theme={theme} review={expandedReview} onClose={() => setExpandedReview(null)} />
            )}
          </div>
        </div>
      </div>

      {/* Autoplay Preview Toggle & Interactive Instructions */}
      <div className="flex flex-col gap-2 rounded-card border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between text-xs">
        <div className="space-y-0.5">
          <span className="font-medium text-text">Autoplay Video Previews</span>
          <p className="text-2xs text-text-muted">
            Muted preview loop plays inside the floating bubble to grab visitor attention.
          </p>
        </div>

        <Switch checked={autoplayPreview} onCheckedChange={(v) => onAutoplayChange?.(v)} aria-label="Autoplay video previews" />
      </div>

      <p className="text-center text-2xs text-text-muted">
        Tip: Click the widget in the preview above to test the interactive video modal experience.
      </p>
    </div>
  );
}
