"use client";

import { useEffect, useState } from "react";
import {
  PLATFORM_PRESETS,
  type FramingMode,
  type PlatformPreset,
  type SocialPlatform,
} from "@/lib/social/presets";

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
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </span>
              <h3 className="text-lg font-bold text-foreground">
                Export for Social Media
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Transform this testimonial into a vertical 9:16 clip for TikTok, Reels, and Shorts.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
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
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-all ${
              activeTab === "create"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Create Export
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`border-b-2 px-4 py-2.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Previous Exports
            {exportHistory.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-bold">
                {exportHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive flex items-start gap-2">
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
                <div className="rounded-2xl border bg-muted/40 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        ✓ Ready to Download
                      </span>
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {activeExport.format} (9:16)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveExport(null)}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Export another format
                    </button>
                  </div>

                  {/* 9:16 Video Player */}
                  <div className="mx-auto flex justify-center">
                    <div className="relative aspect-[9/16] w-56 overflow-hidden rounded-xl border bg-black shadow-lg">
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
                      className="flex w-full sm:flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow hover:opacity-90"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download MP4 Video
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyLink(activeExport.outputUrl!)}
                      className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border bg-card px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted"
                    >
                      <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {copiedLink ? "Copied!" : "Copy Share Link"}
                    </button>
                  </div>
                </div>
              ) : activeExport && (activeExport.status === "pending" || activeExport.status === "processing") ? (
                /* Processing State */
                <div className="rounded-2xl border bg-card p-8 text-center space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <svg className="h-7 w-7 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-foreground">
                      Rendering 9:16 Video...
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Reformatting for {currentPreset.name}, applying branding, and burning in captions. This takes 10–25 seconds.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    Status: {activeExport.status}
                  </div>
                </div>
              ) : (
                /* Configuration Form */
                <>
                  {/* Platform Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
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
                            className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5 ring-2 ring-primary"
                                : "border-border hover:bg-muted/50"
                            }`}
                          >
                            <span className="font-bold text-sm text-foreground">
                              {preset.name}
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground mt-0.5">
                              {preset.badge}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Framing Style */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Vertical Framing Style
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setFraming("blur")}
                        className={`rounded-xl border p-3.5 text-left transition-all ${
                          framing === "blur"
                            ? "border-primary bg-primary/5 ring-2 ring-primary"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="font-semibold text-xs text-foreground">
                          Blurred Background
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Modern aesthetic, video covers canvas with blurred ambient backdrop
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFraming("letterbox")}
                        className={`rounded-xl border p-3.5 text-left transition-all ${
                          framing === "letterbox"
                            ? "border-primary bg-primary/5 ring-2 ring-primary"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <div className="font-semibold text-xs text-foreground">
                          Solid Letterbox
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Clean minimal black frame preserving the exact original aspect ratio
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Toggles: Captions, Branding, Watermark */}
                  <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-foreground">
                          Burn in Captions
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          Subtitles formatted for social video feeds with sound off
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeCaptions}
                        onChange={(e) => setIncludeCaptions(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>

                    <div className="border-t pt-3 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-foreground">
                          Customer Branding Header
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          Display customer name and company badge at top
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeBranding}
                        onChange={(e) => setIncludeBranding(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </div>

                    <div className="border-t pt-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground">
                            Vouchreel Watermark
                          </span>
                          {!canRemoveWatermark && (
                            <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-bold uppercase text-muted-foreground">
                              Free Plan
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
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
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Submit Action */}
                  <button
                    type="button"
                    onClick={handleTriggerExport}
                    disabled={isExporting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow hover:opacity-90 disabled:opacity-50"
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
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Loading export history...
                </div>
              ) : exportHistory.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
                  No social exports generated yet for this testimonial.
                </div>
              ) : (
                exportHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border bg-card p-3.5 transition-all hover:bg-muted/40"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground uppercase">
                          {item.format}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.2 text-[10px] font-semibold ${
                            item.status === "done"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : item.status === "failed"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-amber-500/10 text-amber-600"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
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
                            className="rounded-lg border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            Copy Link
                          </button>
                          <a
                            href={item.outputUrl}
                            download={`vouchreel-${item.format}-${item.id}.mp4`}
                            className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground hover:opacity-90"
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
    </div>
  );
}
