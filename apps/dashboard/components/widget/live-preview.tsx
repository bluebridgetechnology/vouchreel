"use client";

import { useState } from "react";
import {
  WidgetPosition,
  WidgetTemplate,
  WidgetTheme,
  TriggerType,
} from "@/lib/validations/widget-config";
import { buttonVariants } from "@/components/ui/button";

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
  const [expandedReview, setExpandedReview] = useState<{
    authorName: string;
    rating: number;
    text: string;
    provider: string;
    date: string;
  } | null>(null);

  const isDark = theme.mode === "dark";

  // Trigger preview text
  function getTriggerLabel() {
    switch (triggerType) {
      case "delay":
        return `Trigger: ${triggerValue.seconds ?? 5}s delay`;
      case "scroll-depth":
        return `Trigger: ${triggerValue.percentage ?? 50}% scroll`;
      case "pageview-count":
        return `Trigger: ${triggerValue.count ?? 2} pageviews`;
      case "exit-intent":
        return "Trigger: Exit intent";
      case "returning-visitor":
        return "Trigger: Returning visitor";
      default:
        return "Trigger: Instant";
    }
  }

  return (
    <div className="flex flex-col space-y-3">
      {/* Viewport & Controls Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-pill bg-success animate-pulse" />
          <span className="text-xs font-medium text-foreground">Live Widget Preview</span>
          <span className="hidden rounded-control bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground sm:inline-block">
            {getTriggerLabel()}
          </span>
        </div>

        <div className="flex items-center gap-1.5 rounded-card border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setViewport("desktop")}
            className={`flex items-center gap-1 rounded-control px-2.5 py-1 text-xs font-medium transition-all ${
              viewport === "desktop"
                ? "bg-background text-foreground shadow-xs font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Desktop
          </button>

          <button
            type="button"
            onClick={() => setViewport("mobile")}
            className={`flex items-center gap-1 rounded-control px-2.5 py-1 text-xs font-medium transition-all ${
              viewport === "mobile"
                ? "bg-background text-foreground shadow-xs font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Mobile
          </button>
        </div>
      </div>

      {/* Preview Viewport Frame */}
      <div className="flex items-center justify-center rounded-card border bg-muted/40 p-4 transition-all min-h-[460px]">
        <div
          className={`relative overflow-hidden rounded-card border border-border shadow-float transition-all duration-300 ${
            viewport === "desktop"
              ? "h-[500px] w-full bg-background"
              : "h-[580px] w-[340px] rounded-[36px] border-[8px] border-border-strong bg-background shadow-float"
          }`}
        >
          {/* Mobile Speaker / Camera Notch */}
          {viewport === "mobile" && (
            <div className="absolute top-2 left-1/2 z-30 h-3.5 w-24 -translate-x-1/2 rounded-pill bg-text-inverse/10" />
          )}

          {/* Browser / App Header */}
          <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2 text-2xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-pill bg-danger" />
              <div className="h-2 w-2 rounded-pill bg-warning" />
              <div className="h-2 w-2 rounded-pill bg-success" />
            </div>
            <div className="rounded-pill bg-background/80 px-4 py-0.5 text-2xs text-muted-foreground font-mono">
              https://yourbrand.com
            </div>
            <div className="w-6" />
          </div>

          {/* Mock Website Canvas */}
          <div className="relative h-[calc(100%-37px)] overflow-y-auto bg-gradient-to-b from-background to-muted/20 p-4 select-none">
            {/* Mock Navigation */}
            <div className="flex items-center justify-between pb-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-control bg-primary/20 flex items-center justify-center font-medium text-2xs text-primary">
                  V
                </div>
                <span className="text-xs font-medium text-foreground">Acme Corp</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-8 rounded-control bg-muted" />
                <div className="h-2 w-8 rounded-control bg-muted" />
                <div className="h-5 rounded-control bg-primary/20 px-2 text-3xs font-medium text-primary flex items-center">
                  Sign In
                </div>
              </div>
            </div>

            {/* Mock Hero Section */}
            <div className="py-8 text-center space-y-2.5">
              <span className="inline-flex rounded-pill bg-primary/10 px-2.5 py-0.5 text-3xs font-medium text-primary">
                ★ 4.9/5 stars from 300+ founders
              </span>
              <h1 className="text-base font-medium tracking-tight text-foreground sm:text-lg">
                Supercharge Growth with Authentic Video Testimonials
              </h1>
              <p className="mx-auto max-w-xs text-2xs text-muted-foreground leading-relaxed">
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
            {template === "wall-of-love" && (
              <div className="pt-3 space-y-2">
                <div className="text-2xs font-medium text-foreground">Wall of Love Preview</div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Video Testimonial Card */}
                  <button
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    className="flex flex-col text-left rounded-card border bg-card/80 p-2 shadow-xs hover:border-primary/50 transition-all cursor-pointer"
                  >
                    <div className="relative aspect-video w-full rounded-control bg-scrim overflow-hidden mb-1.5">
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"
                        alt="Customer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="h-6 w-6 rounded-pill flex items-center justify-center text-on-media shadow-xs"
                          style={{ backgroundColor: theme.primaryColor }}
                        >
                          <svg className="h-3 w-3 ml-0.5 fill-current" viewBox="0 0 24 24">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <span className="text-3xs font-medium text-primary">📹 Video Testimonial</span>
                    <p className="text-2xs text-foreground line-clamp-2 mt-0.5">
                      &ldquo;Conversions spiked immediately!&rdquo;
                    </p>
                    <p className="text-3xs text-muted-foreground mt-1">Sarah Johnson • 1:42</p>
                  </button>

                  {/* Google Review Card */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedReview({
                        authorName: "Alex Morgan",
                        rating: 5,
                        text: "Vouchreel transformed our landing page social proof. Conversions increased by 38% in our first month!",
                        provider: "Google Reviews",
                        date: "2 days ago",
                      })
                    }
                    className="flex flex-col text-left rounded-card border bg-card/80 p-2 shadow-xs hover:border-primary/50 transition-all cursor-pointer justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-3xs font-medium px-1.5 py-0.5 rounded-control bg-info-soft text-info-foreground">
                          Google
                        </span>
                        <span className="text-warning text-2xs">★★★★★</span>
                      </div>
                      <p className="text-2xs text-foreground line-clamp-3">
                        &ldquo;Vouchreel transformed our landing page social proof. Conversions increased by 38%!&rdquo;
                      </p>
                    </div>
                    <p className="text-3xs text-muted-foreground mt-2 border-t pt-1">
                      Alex Morgan • 2 days ago
                    </p>
                  </button>

                  {/* Trustpilot Review Card */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedReview({
                        authorName: "Elena Rostova",
                        rating: 5,
                        text: "Incredible tool. Collecting and displaying customer feedback has never been easier.",
                        provider: "Trustpilot",
                        date: "1 week ago",
                      })
                    }
                    className="flex flex-col text-left rounded-card border bg-card/80 p-2 shadow-xs hover:border-primary/50 transition-all cursor-pointer justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-3xs font-medium px-1.5 py-0.5 rounded-control bg-success-soft text-success-foreground">
                          Trustpilot
                        </span>
                        <span className="text-warning text-2xs">★★★★★</span>
                      </div>
                      <p className="text-2xs text-foreground line-clamp-3">
                        &ldquo;Incredible tool. Collecting customer feedback has never been easier.&rdquo;
                      </p>
                    </div>
                    <p className="text-3xs text-muted-foreground mt-2 border-t pt-1">
                      Elena Rostova • 1 week ago
                    </p>
                  </button>

                  {/* Second Video Testimonial Card */}
                  <button
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    className="flex flex-col text-left rounded-card border bg-card/80 p-2 shadow-xs hover:border-primary/50 transition-all cursor-pointer"
                  >
                    <div className="relative aspect-video w-full rounded-control bg-scrim overflow-hidden mb-1.5">
                      <img
                        src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80"
                        alt="Customer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="h-6 w-6 rounded-pill flex items-center justify-center text-on-media shadow-xs"
                          style={{ backgroundColor: theme.primaryColor }}
                        >
                          <svg className="h-3 w-3 ml-0.5 fill-current" viewBox="0 0 24 24">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <span className="text-3xs font-medium text-primary">📹 Video Testimonial</span>
                    <p className="text-2xs text-foreground line-clamp-2 mt-0.5">
                      &ldquo;Our best marketing investment.&rdquo;
                    </p>
                    <p className="text-3xs text-muted-foreground mt-1">David K. • 0:54</p>
                  </button>
                </div>
              </div>
            )}

            {template === "carousel" && (
              <div className="pt-3 space-y-2">
                <div className="text-2xs font-medium text-foreground">Carousel Preview</div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {/* Card 1: Video */}
                  <button
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    className="flex flex-col text-left shrink-0 w-36 rounded-card border bg-card/80 p-2 shadow-xs hover:border-primary/50 cursor-pointer"
                  >
                    <div className="relative aspect-video w-full rounded-control bg-scrim overflow-hidden mb-1">
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"
                        alt="Customer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          className="h-5 w-5 rounded-pill flex items-center justify-center text-on-media"
                          style={{ backgroundColor: theme.primaryColor }}
                        >
                          <svg className="h-2.5 w-2.5 ml-0.5 fill-current" viewBox="0 0 24 24">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <p className="text-3xs font-medium text-foreground truncate">Sarah Johnson</p>
                    <p className="text-3xs text-muted-foreground line-clamp-1">&ldquo;Doubled conversions&rdquo;</p>
                  </button>

                  {/* Card 2: Google Review */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedReview({
                        authorName: "Alex Morgan",
                        rating: 5,
                        text: "Vouchreel transformed our landing page social proof. Highly recommend!",
                        provider: "Google Reviews",
                        date: "2 days ago",
                      })
                    }
                    className="flex flex-col text-left shrink-0 w-36 rounded-card border bg-card/80 p-2 shadow-xs hover:border-primary/50 cursor-pointer justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-3xs font-medium px-1 rounded-control bg-info-soft text-info-foreground">Google</span>
                        <span className="text-warning text-3xs">★★★★★</span>
                      </div>
                      <p className="text-3xs text-foreground line-clamp-2">
                        &ldquo;Transformed our social proof!&rdquo;
                      </p>
                    </div>
                    <p className="text-3xs text-muted-foreground mt-1 border-t pt-0.5">Alex M.</p>
                  </button>

                  {/* Card 3: Trustpilot Review */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedReview({
                        authorName: "Elena Rostova",
                        rating: 5,
                        text: "Incredible tool. Collecting customer feedback has never been easier.",
                        provider: "Trustpilot",
                        date: "1 week ago",
                      })
                    }
                    className="flex flex-col text-left shrink-0 w-36 rounded-card border bg-card/80 p-2 shadow-xs hover:border-primary/50 cursor-pointer justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-3xs font-medium px-1 rounded-control bg-success-soft text-success-foreground">Trustpilot</span>
                        <span className="text-warning text-3xs">★★★★★</span>
                      </div>
                      <p className="text-3xs text-foreground line-clamp-2">
                        &ldquo;Never been easier to gather proof.&rdquo;
                      </p>
                    </div>
                    <p className="text-3xs text-muted-foreground mt-1 border-t pt-0.5">Elena R.</p>
                  </button>
                </div>
              </div>
            )}

            {template === "masonry" && (
              <div className="pt-3 space-y-2">
                <div className="text-2xs font-medium text-foreground">Masonry Grid Preview</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => setIsExpanded(true)}
                      className="w-full text-left rounded-card border bg-card/80 p-2 shadow-xs hover:border-primary/50 cursor-pointer"
                    >
                      <div className="relative aspect-video w-full rounded-control bg-scrim overflow-hidden mb-1">
                        <img
                          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"
                          alt="Customer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-3xs font-medium text-foreground">Sarah J. • 1:42</p>
                      <p className="text-3xs text-muted-foreground">&ldquo;Super simple to use&rdquo;</p>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedReview({
                          authorName: "Elena Rostova",
                          rating: 5,
                          text: "Very polished widget and easy integration.",
                          provider: "Trustpilot",
                          date: "1 week ago",
                        })
                      }
                      className="w-full text-left rounded-card border bg-card/80 p-2 shadow-xs hover:border-primary/50 cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-3xs font-medium px-1 rounded-control bg-success-soft text-success-foreground">Trustpilot</span>
                        <span className="text-warning text-3xs">★★★★★</span>
                      </div>
                      <p className="text-3xs text-foreground">&ldquo;Very polished widget and easy integration.&rdquo;</p>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedReview({
                          authorName: "Alex Morgan",
                          rating: 5,
                          text: "Top-tier social proof tool. The video plus text blends seamlessly.",
                          provider: "Google Reviews",
                          date: "2 days ago",
                        })
                      }
                      className="w-full text-left rounded-card border bg-card/80 p-2 shadow-xs hover:border-primary/50 cursor-pointer"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-3xs font-medium px-1 rounded-control bg-info-soft text-info-foreground">Google</span>
                        <span className="text-warning text-3xs">★★★★★</span>
                      </div>
                      <p className="text-3xs text-foreground">&ldquo;Top-tier social proof tool. The video plus text blends seamlessly.&rdquo;</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsExpanded(true)}
                      className="w-full text-left rounded-card border bg-card/80 p-2 shadow-xs hover:border-primary/50 cursor-pointer"
                    >
                      <div className="relative aspect-video w-full rounded-control bg-scrim overflow-hidden mb-1">
                        <img
                          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80"
                          alt="Customer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-3xs font-medium text-foreground">David K. • 0:54</p>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* EXPANDED VIDEO TESTIMONIAL PREVIEW MODAL */}
            {isExpanded && (
              <div
                className={`absolute inset-0 z-30 flex items-center justify-center bg-scrim/60 backdrop-blur-xs p-3 transition-opacity ${
                  viewport === "mobile" ? "items-end p-0" : ""
                }`}
              >
                <div
                  className={`relative w-full overflow-hidden shadow-float transition-all ${
                    viewport === "mobile"
                      ? "rounded-t-2xl border-t border-border"
                      : "max-w-[280px] border border-border"
                  } ${isDark ? "bg-surface-inverse text-on-media" : "bg-surface text-text"}`}
                  style={{
                    borderRadius:
                      viewport === "mobile"
                        ? `${theme.borderRadius}px ${theme.borderRadius}px 0 0`
                        : `${theme.borderRadius}px`,
                  }}
                >
                  {/* Close Preview Button */}
                  <button
                    type="button"
                    aria-label="Close preview modal"
                    onClick={() => setIsExpanded(false)}
                    className="absolute right-2.5 top-2.5 z-40 flex h-6 w-6 items-center justify-center rounded-pill bg-scrim/50 text-on-media hover:bg-scrim/70"
                    title="Close preview modal"
                  >
                    ×
                  </button>

                  {/* Video Player Mock */}
                  <div className="relative aspect-[9/14] max-h-[300px] w-full overflow-hidden bg-scrim">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80"
                      alt="Customer Video"
                      className="h-full w-full object-cover opacity-85"
                    />

                    {/* Centered Big Play Button */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-pill shadow-float transition-transform hover:scale-110 cursor-pointer"
                        style={{
                          backgroundColor: theme.primaryColor,
                          color: theme.accentColor,
                        }}
                      >
                        <svg className="h-5 w-5 ml-0.5 fill-current" viewBox="0 0 24 24">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    </div>

                    {/* Video Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-on-media/20">
                      <div
                        className="h-full w-1/3"
                        style={{ backgroundColor: theme.primaryColor }}
                      />
                    </div>
                  </div>

                  {/* Modal Details Section */}
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium leading-tight">
                          Sarah Johnson
                        </div>
                        <div className="text-2xs text-muted-foreground">
                          Founder, CloudScale
                        </div>
                      </div>
                      <span
                        className="rounded-control px-1.5 py-0.5 text-3xs font-medium"
                        style={{
                          backgroundColor: `${theme.primaryColor}20`,
                          color: theme.primaryColor,
                        }}
                      >
                        Verified
                      </span>
                    </div>

                    <p className="text-2xs italic leading-snug">
                      &ldquo;Vouchreel completely transformed our marketing funnel. Our landing page conversion shot up 34%!&rdquo;
                    </p>

                    <div className="pt-1">
                      <button
                        type="button"
                        className="w-full py-1.5 text-center text-xs font-medium shadow-xs"
                        style={{
                          backgroundColor: theme.primaryColor,
                          color: theme.accentColor,
                          borderRadius: `${Math.max(4, theme.borderRadius - 4)}px`,
                        }}
                      >
                        Get Started Like Sarah
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* EXPANDED REVIEW PREVIEW MODAL */}
            {expandedReview && (
              <div
                className={`absolute inset-0 z-30 flex items-center justify-center bg-scrim/60 backdrop-blur-xs p-3 transition-opacity ${
                  viewport === "mobile" ? "items-end p-0" : ""
                }`}
              >
                <div
                  className={`relative w-full overflow-hidden shadow-float transition-all ${
                    viewport === "mobile"
                      ? "rounded-t-2xl border-t border-border"
                      : "max-w-[280px] border border-border"
                  } ${isDark ? "bg-surface-inverse text-on-media" : "bg-surface text-text"}`}
                  style={{
                    borderRadius:
                      viewport === "mobile"
                        ? `${theme.borderRadius}px ${theme.borderRadius}px 0 0`
                        : `${theme.borderRadius}px`,
                  }}
                >
                  <button
                    type="button"
                    aria-label="Close review modal"
                    onClick={() => setExpandedReview(null)}
                    className="absolute right-2.5 top-2.5 z-40 flex h-6 w-6 items-center justify-center rounded-pill bg-scrim/20 text-foreground hover:bg-scrim/40 cursor-pointer"
                  >
                    ✕
                  </button>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-medium px-2 py-0.5 rounded-control bg-primary/10 text-primary">
                        {expandedReview.provider}
                      </span>
                      <span className="text-warning text-xs">
                        {Array.from({ length: 5 }).map((_, i) =>
                          i < expandedReview.rating ? "★" : "☆"
                        )}
                      </span>
                    </div>

                    <p className="text-xs text-foreground/90 italic leading-relaxed">
                      &ldquo;{expandedReview.text}&rdquo;
                    </p>

                    <div className="pt-2 border-t flex items-center justify-between text-2xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {expandedReview.authorName}
                      </span>
                      <span>{expandedReview.date}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Autoplay Preview Toggle & Interactive Instructions */}
      <div className="flex flex-col gap-2 rounded-card border bg-card p-3 sm:flex-row sm:items-center sm:justify-between text-xs">
        <div className="space-y-0.5">
          <span className="font-medium text-foreground">Autoplay Video Previews</span>
          <p className="text-2xs text-muted-foreground">
            Muted preview loop plays inside the floating bubble to grab visitor attention.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={autoplayPreview}
          aria-label="Autoplay video previews"
          onClick={() => onAutoplayChange?.(!autoplayPreview)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-pill border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            autoplayPreview ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-pill bg-background shadow-float ring-0 transition duration-200 ease-in-out ${
              autoplayPreview ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <p className="text-center text-2xs text-muted-foreground">
        Tip: Click the widget in the preview above to test the interactive video modal experience.
      </p>
    </div>
  );
}
