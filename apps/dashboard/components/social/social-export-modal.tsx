"use client";

import { useEffect, useState } from "react";
import {
  PLATFORM_PRESETS,
  type FramingMode,
  type PlatformPreset,
  type SocialPlatform,
} from "@/lib/social/presets";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { toggleStyle } from "@/components/ui/toggle";
import { ModalOverlay } from "@/components/ui/modal";

export interface SocialExportItem {
  id: string;
  spaceId: string;
  testimonialId: string;
  format: SocialPlatform;
  outputUrl: string | null;
  status: "pending" | "processing" | "done" | "failed";
  errorMessage: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  completedAt?: string | null;
}

interface SocialExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  spaceId: string;
  testimonial: {
    id: string;
    title: string | null;
    customerName: string | null;
    customerCompany: string | null;
    quote: string | null;
    videoUrl: string | null;
    clipUrl?: string | null;
    thumbnailUrl: string | null;
  };
}

export function SocialExportModal({
  isOpen,
  onClose,
  spaceId,
  testimonial,
}: SocialExportModalProps) {
  const [selectedPlatform, setSelectedPlatform] =
    useState<SocialPlatform>("tiktok");
  const [framing, setFraming] = useState<FramingMode>("blur");
  const [includeCaptions, setIncludeCaptions] = useState(true);
  const [includeBranding, setIncludeBranding] = useState(true);
  const [canRemoveWatermark, setCanRemoveWatermark] = useState(false);
  const [showWatermark, setShowWatermark] = useState(true);

  const [activeExport, setActiveExport] = useState<SocialExportItem | null>(null);
  const [exportHistory, setExportHistory] = useState<SocialExportItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "history">("create");

  // Fetch settings & permissions
  useEffect(() => {
    if (!isOpen) return;

    fetch(`/api/spaces/${spaceId}/social-export-settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings) {
          setFraming(data.settings.defaultFraming || "blur");
          setShowWatermark(data.settings.showWatermark ?? true);
        }
        if (data?.limits) {
          setCanRemoveWatermark(data.limits.canRemoveWatermark ?? false);
          if (!data.limits.canRemoveWatermark) {
            setShowWatermark(true);
          }
        }
      })
      .catch(() => undefined);

    fetchHistory();
  }, [isOpen, spaceId, testimonial.id]);

  function fetchHistory() {
    setLoadingHistory(true);
    fetch(`/api/spaces/${spaceId}/testimonials/${testimonial.id}/exports`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.exports) {
          setExportHistory(data.exports);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoadingHistory(false));
  }

  // Poll for export completion
  useEffect(() => {
    if (
      !activeExport ||
      activeExport.status === "done" ||
      activeExport.status === "failed"
    ) {
      return;
    }

    const interval = setInterval(() => {
      fetch(`/api/spaces/${spaceId}/social-exports/${activeExport.id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.export) {
            setActiveExport(data.export);
            if (data.export.status === "done" || data.export.status === "failed") {
              setIsExporting(false);
              fetchHistory();
            }
          }
        })
        .catch(() => undefined);
    }, 2500);

    return () => clearInterval(interval);
  }, [activeExport, spaceId]);

  async function handleTriggerExport() {
    setError(null);
    setIsExporting(true);

    try {
      const res = await fetch(
        `/api/spaces/${spaceId}/testimonials/${testimonial.id}/export`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            format: selectedPlatform,
            framing,
            includeCaptions,
            includeBranding,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to trigger export");
      }

      setActiveExport(data.export);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start export");
      setIsExporting(false);
    }
  }

  function handleCopyLink(url: string) {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  if (!isOpen) return null;

  const currentPreset: PlatformPreset = PLATFORM_PRESETS[selectedPlatform];

  return (
    <ModalOverlay label="Export for social" onClose={onClose}>
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-card border bg-surface shadow-float overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-control bg-brand-soft text-brand">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </span>
              <h3 className="text-lg font-medium text-text">
                Export for Social Media
              </h3>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Transform this testimonial into a vertical 9:16 clip for TikTok, Reels, and Shorts.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={cn("px-4 py-2.5 text-xs font-medium transition-all", toggleStyle("tab", activeTab === "create"))}
          >
            Create Export
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cn("px-4 py-2.5 text-xs font-medium transition-all flex items-center gap-1.5", toggleStyle("tab", activeTab === "history"))}
          >
            Previous Exports
            {exportHistory.length > 0 && (
              <span className="rounded-pill bg-surface-sunken px-1.5 py-0.2 text-2xs font-medium">
                {exportHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-card border border-danger/20 bg-danger-soft p-3.5 text-xs text-danger-foreground flex items-start gap-2">
              <svg className="h-4 w-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {activeTab === "create" ? (
            <>
              {/* If active export is done, show preview player */}
              {activeExport && activeExport.status === "done" && activeExport.outputUrl ? (
                <div className="rounded-card border bg-surface-sunken/40 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-pill bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success-foreground">
                        ✓ Ready to Download
                      </span>
                      <span className="text-xs font-medium uppercase text-text-muted">
                        {activeExport.format} (9:16)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveExport(null)}
                      className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-xs underline")}
                    >
                      Export another format
                    </button>
                  </div>

                  {/* 9:16 Video Player */}
                  <div className="mx-auto flex justify-center">
                    <div className="relative aspect-[9/16] w-56 overflow-hidden rounded-card border bg-scrim shadow-float">
                      <video
                        src={activeExport.outputUrl}
                        controls
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <a
                      href={activeExport.outputUrl}
                      download={`vouchreel-${selectedPlatform}-${testimonial.id}.mp4`}
                      className={cn(buttonVariants({ variant: "primary", size: "sm" }), "w-full sm:flex-1")}
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download MP4 Video
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyLink(activeExport.outputUrl!)}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full sm:w-auto")}
                    >
                      <svg className="h-4 w-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {copiedLink ? "Copied!" : "Copy Share Link"}
                    </button>
                  </div>
                </div>
              ) : activeExport && (activeExport.status === "pending" || activeExport.status === "processing") ? (
                /* Processing State */
                <div className="rounded-card border bg-surface p-5 sm:p-8 text-center space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-pill bg-brand-soft text-brand">
                    <svg className="h-7 w-7 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-base font-medium text-text">
                      Rendering 9:16 Video...
                    </h4>
                    <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                      Reformatting for {currentPreset.name}, applying branding, and burning in captions. This takes 10–25 seconds.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-pill bg-surface-sunken px-3 py-1 text-xs text-text-muted">
                    <span className="h-2 w-2 rounded-pill bg-brand animate-pulse" />
                    Status: {activeExport.status}
                  </div>
                </div>
              ) : (
                /* Configuration Form */
                <>
                  {/* Platform Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                      Target Social Platform
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {(["tiktok", "reels", "shorts"] as SocialPlatform[]).map((platform) => {
                        const preset = PLATFORM_PRESETS[platform];
                        const isSelected = selectedPlatform === platform;
                        return (
                          <button
                            key={platform}
                            type="button"
                            onClick={() => setSelectedPlatform(platform)}
                            className={cn("flex flex-col items-start rounded-card border p-3.5 text-left transition-all", toggleStyle("choice", isSelected))}
                          >
                            <span className="font-medium text-sm text-text">
                              {preset.name}
                            </span>
                            <span className="text-2xs font-medium text-text-muted mt-0.5">
                              {preset.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Framing Style */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                      Vertical Framing Style
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFraming("blur")}
                        className={cn("rounded-card border p-3.5 text-left transition-all", toggleStyle("choice", framing === "blur"))}
                      >
                        <div className="font-medium text-xs text-text">
                          Blurred Background
                        </div>
                        <div className="text-2xs text-text-muted mt-0.5">
                          Modern aesthetic, video covers canvas with blurred ambient backdrop
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFraming("letterbox")}
                        className={cn("rounded-card border p-3.5 text-left transition-all", toggleStyle("choice", framing === "letterbox"))}
                      >
                        <div className="font-medium text-xs text-text">
                          Solid Letterbox
                        </div>
                        <div className="text-2xs text-text-muted mt-0.5">
                          Clean minimal black frame preserving the exact original aspect ratio
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Toggles: Captions, Branding, Watermark */}
                  <div className="rounded-card border bg-surface-sunken/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-medium text-text">
                          Burn in Captions
                        </span>
                        <p className="text-2xs text-text-muted">
                          Subtitles formatted for social video feeds with sound off
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeCaptions}
                        onChange={(e) => setIncludeCaptions(e.target.checked)}
                        className="h-4 w-4 rounded-control border-border-strong text-brand focus:ring-brand"
                      />
                    </div>

                    <div className="border-t pt-3 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-medium text-text">
                          Customer Branding Header
                        </span>
                        <p className="text-2xs text-text-muted">
                          Display customer name and company badge at top
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeBranding}
                        onChange={(e) => setIncludeBranding(e.target.checked)}
                        className="h-4 w-4 rounded-control border-border-strong text-brand focus:ring-brand"
                      />
                    </div>

                    <div className="border-t pt-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-text">
                            Vouchreel Watermark
                          </span>
                          {!canRemoveWatermark && (
                            <span className="rounded-control bg-surface-sunken px-1.5 py-0.2 text-3xs font-medium uppercase text-text-muted">
                              Free Plan
                            </span>
                          )}
                        </div>
                        <p className="text-2xs text-text-muted">
                          {canRemoveWatermark
                            ? "Toggle watermark for organic attribution"
                            : "Watermark is included on Free tier. Upgrade to Pro to remove."}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        disabled={!canRemoveWatermark}
                        checked={showWatermark}
                        onChange={(e) => setShowWatermark(e.target.checked)}
                        className="h-4 w-4 rounded-control border-border-strong text-brand focus:ring-brand disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Submit Action */}
                  <button
                    type="button"
                    onClick={handleTriggerExport}
                    disabled={isExporting}
                    className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full")}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Generate {currentPreset.name} Video (9:16)
                  </button>
                </>
              )}
            </>
          ) : (
            /* History Tab */
            <div className="space-y-3">
              {loadingHistory ? (
                <div className="py-8 text-center text-xs text-text-muted">
                  Loading export history...
                </div>
              ) : exportHistory.length === 0 ? (
                <div className="rounded-card border border-dashed p-8 text-center text-xs text-text-muted">
                  No social exports generated yet for this testimonial.
                </div>
              ) : (
                exportHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-card border bg-surface p-3.5 transition-all hover:bg-surface-sunken/40"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs text-text uppercase">
                          {item.format}
                        </span>
                        <span
                          className={`rounded-pill px-2 py-0.2 text-2xs font-medium ${
                            item.status === "done"
                              ? "bg-success-soft text-success-foreground"
                              : item.status === "failed"
                              ? "bg-danger-soft text-danger-foreground"
                              : "bg-warning-soft text-warning-foreground"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="text-2xs text-text-muted">
                        {new Date(item.createdAt).toLocaleDateString()} at{" "}
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === "done" && item.outputUrl && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(item.outputUrl!)}
                            className={buttonVariants({ variant: "outline", size: "sm" })}
                          >
                            Copy Link
                          </button>
                          <a
                            href={item.outputUrl}
                            download={`vouchreel-${item.format}-${item.id}.mp4`}
                            className={buttonVariants({ variant: "primary", size: "sm" })}
                          >
                            Download
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
