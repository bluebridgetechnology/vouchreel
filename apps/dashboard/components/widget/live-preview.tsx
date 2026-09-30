"use client";

import { useState } from "react";
import {
  WidgetPosition,
  WidgetTheme,
  TriggerType,
} from "@/lib/validations/widget-config";

interface LivePreviewProps {
  position: WidgetPosition;
  theme: WidgetTheme;
  triggerType: TriggerType;
  triggerValue: Record<string, unknown>;
  autoplayPreview: boolean;
  onAutoplayChange?: (enabled: boolean) => void;
}

export function LivePreview({
  position,
  theme,
  triggerType,
  triggerValue,
  autoplayPreview,
  onAutoplayChange,
}: LivePreviewProps) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [isExpanded, setIsExpanded] = useState(false);

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
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-foreground">Live Widget Preview</span>
          <span className="hidden rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            {getTriggerLabel()}
          </span>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setViewport("desktop")}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              viewport === "desktop"
                ? "bg-background text-foreground shadow-xs font-semibold"
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
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              viewport === "mobile"
                ? "bg-background text-foreground shadow-xs font-semibold"
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
      <div className="flex items-center justify-center rounded-xl border bg-muted/40 p-4 transition-all min-h-[460px]">
        <div
          className={`relative overflow-hidden rounded-xl border border-border shadow-lg transition-all duration-300 ${
            viewport === "desktop"
              ? "h-[500px] w-full bg-background"
              : "h-[580px] w-[340px] rounded-[36px] border-[8px] border-neutral-800 bg-background shadow-2xl"
          }`}
        >
          {/* Mobile Speaker / Camera Notch */}
          {viewport === "mobile" && (
            <div className="absolute top-2 left-1/2 z-30 h-3.5 w-24 -translate-x-1/2 rounded-full bg-neutral-800" />
          )}

          {/* Browser / App Header */}
          <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-red-400" />
              <div className="h-2 w-2 rounded-full bg-yellow-400" />
              <div className="h-2 w-2 rounded-full bg-green-400" />
            </div>
            <div className="rounded-full bg-background/80 px-4 py-0.5 text-[10px] text-muted-foreground font-mono">
              https://yourbrand.com
            </div>
            <div className="w-6" />
          </div>

          {/* Mock Website Canvas */}
          <div className="relative h-[calc(100%-37px)] overflow-y-auto bg-gradient-to-b from-background to-muted/20 p-4 select-none">
            {/* Mock Navigation */}
            <div className="flex items-center justify-between pb-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-md bg-primary/20 flex items-center justify-center font-bold text-[10px] text-primary">
                  V
                </div>
                <span className="text-xs font-bold text-foreground">Acme Corp</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-8 rounded bg-muted" />
                <div className="h-2 w-8 rounded bg-muted" />
                <div className="h-5 rounded bg-primary/20 px-2 text-[9px] font-medium text-primary flex items-center">
                  Sign In
                </div>
              </div>
            </div>

            {/* Mock Hero Section */}
            <div className="py-8 text-center space-y-2.5">
              <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-[9px] font-semibold text-primary">
                ★ 4.9/5 stars from 300+ founders
              </span>
              <h1 className="text-base font-extrabold tracking-tight text-foreground sm:text-lg">
                Supercharge Growth with Authentic Video Testimonials
              </h1>
              <p className="mx-auto max-w-xs text-[11px] text-muted-foreground leading-relaxed">
                Collect, embed, and showcase trust-building video proof that drives conversion on any site.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  type="button"
                  className="rounded px-3 py-1 text-[10px] font-medium text-white shadow-xs"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  Start 14-day Free Trial
                </button>
                <button
                  type="button"
                  className="rounded border bg-background px-3 py-1 text-[10px] font-medium text-foreground hover:bg-muted"
                >
                  Book Demo
                </button>
              </div>
            </div>

            {/* Mock Content Cards */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="rounded-lg border bg-card/60 p-2.5 space-y-1">
                <div className="h-2 w-16 rounded bg-primary/30" />
                <div className="h-1.5 w-full rounded bg-muted" />
                <div className="h-1.5 w-3/4 rounded bg-muted" />
              </div>
              <div className="rounded-lg border bg-card/60 p-2.5 space-y-1">
                <div className="h-2 w-16 rounded bg-primary/30" />
                <div className="h-1.5 w-full rounded bg-muted" />
                <div className="h-1.5 w-2/3 rounded bg-muted" />
              </div>
            </div>

            {/* WIDGET LAUNCHER RENDERING */}

            {/* 1. Bottom Right or Bottom Left Floating Launcher */}
            {(position === "bottom-right" || position === "bottom-left") && (
              <div
                className={`absolute z-20 transition-all duration-300 ${
                  position === "bottom-right" ? "bottom-4 right-4" : "bottom-4 left-4"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="group relative flex items-center gap-2 p-1.5 shadow-xl transition-transform hover:scale-105"
                  style={{
                    backgroundColor: theme.primaryColor,
                    color: theme.accentColor,
                    borderRadius: `${theme.borderRadius}px`,
                  }}
                >
                  {/* Circular Avatar Thumbnail */}
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-white/50 bg-black shadow-inner">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                      alt="Customer"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-black shadow-sm">
                        <svg className="h-2.5 w-2.5 ml-0.5 fill-current" viewBox="0 0 24 24">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Text Badge */}
                  <div className="pr-2 text-left">
                    <div className="text-[11px] font-bold leading-tight">
                      Hear Sarah’s Story
                    </div>
                    <div className="text-[9px] opacity-80 leading-none">
                      Verified Customer • 1:42
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* 2. Bottom Bar Launcher */}
            {position === "bottom-bar" && (
              <div className="absolute bottom-0 left-0 right-0 z-20">
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex w-full items-center justify-between px-3 py-2 shadow-2xl transition-opacity hover:opacity-95"
                  style={{
                    backgroundColor: theme.primaryColor,
                    color: theme.accentColor,
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-white/60 bg-black">
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"
                        alt="Customer"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] font-bold leading-tight">
                        &ldquo;Vouchreel doubled our conversion in 2 weeks!&rdquo;
                      </p>
                      <p className="text-[9px] opacity-80">
                        Sarah Johnson, Founder of CloudScale
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold backdrop-blur-xs">
                    <svg className="h-2.5 w-2.5 fill-current" viewBox="0 0 24 24">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Watch Story
                  </div>
                </button>
              </div>
            )}

            {/* 3. Story Strip Launcher */}
            {position === "story-strip" && (
              <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center gap-3 overflow-x-auto rounded-xl border bg-background/90 p-2 backdrop-blur-xs shadow-lg">
                {[
                  {
                    name: "Sarah J.",
                    img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
                    watched: false,
                  },
                  {
                    name: "David K.",
                    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
                    watched: true,
                  },
                  {
                    name: "Elena R.",
                    img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
                    watched: false,
                  },
                ].map((story, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    className="flex flex-col items-center gap-1 shrink-0 group focus:outline-none"
                  >
                    <div
                      className="relative h-11 w-11 rounded-full p-0.5 transition-transform group-hover:scale-105"
                      style={{
                        background: story.watched
                          ? "rgba(150,150,150,0.4)"
                          : `linear-gradient(45deg, ${theme.primaryColor}, #f43f5e)`,
                      }}
                    >
                      <div className="h-full w-full overflow-hidden rounded-full border-2 border-background">
                        <img
                          src={story.img}
                          alt={story.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
                        <svg className="h-2 w-2 fill-current" viewBox="0 0 24 24">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    </div>
                    <span className="text-[9px] font-medium text-foreground max-w-[50px] truncate">
                      {story.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* EXPANDED VIDEO TESTIMONIAL PREVIEW MODAL */}
            {isExpanded && (
              <div
                className={`absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 transition-opacity ${
                  viewport === "mobile" ? "items-end p-0" : ""
                }`}
              >
                <div
                  className={`relative w-full overflow-hidden shadow-2xl transition-all ${
                    viewport === "mobile"
                      ? "rounded-t-2xl border-t border-border"
                      : "max-w-[280px] border border-border"
                  } ${isDark ? "bg-neutral-900 text-white" : "bg-white text-neutral-900"}`}
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
                    className="absolute right-2.5 top-2.5 z-40 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                    title="Close preview modal"
                  >
                    ×
                  </button>

                  {/* Video Player Mock */}
                  <div className="relative aspect-[9/14] max-h-[300px] w-full overflow-hidden bg-black">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80"
                      alt="Customer Video"
                      className="h-full w-full object-cover opacity-85"
                    />

                    {/* Centered Big Play Button */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 cursor-pointer"
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
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
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
                        <div className="text-xs font-bold leading-tight">
                          Sarah Johnson
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Founder, CloudScale
                        </div>
                      </div>
                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-semibold"
                        style={{
                          backgroundColor: `${theme.primaryColor}20`,
                          color: theme.primaryColor,
                        }}
                      >
                        Verified
                      </span>
                    </div>

                    <p className="text-[11px] italic leading-snug">
                      &ldquo;Vouchreel completely transformed our marketing funnel. Our landing page conversion shot up 34%!&rdquo;
                    </p>

                    <div className="pt-1">
                      <button
                        type="button"
                        className="w-full py-1.5 text-center text-xs font-semibold shadow-xs"
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
          </div>
        </div>
      </div>

      {/* Autoplay Preview Toggle & Interactive Instructions */}
      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between text-xs">
        <div className="space-y-0.5">
          <span className="font-semibold text-foreground">Autoplay Video Previews</span>
          <p className="text-[11px] text-muted-foreground">
            Muted preview loop plays inside the floating bubble to grab visitor attention.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={autoplayPreview}
          aria-label="Autoplay video previews"
          onClick={() => onAutoplayChange?.(!autoplayPreview)}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            autoplayPreview ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
              autoplayPreview ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Tip: Click the widget in the preview above to test the interactive video modal experience.
      </p>
    </div>
  );
}
