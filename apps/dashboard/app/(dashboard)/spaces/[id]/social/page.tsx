"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  PLATFORM_PRESETS,
  type FramingMode,
  type WatermarkPosition,
} from "@/lib/social/presets";
import { DEFAULT_BRAND_HEX } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { toggleStyle } from "@/components/ui/toggle";
import { notify } from "@/lib/notify";

interface SocialPageProps {
  params: Promise<{ id: string }>;
}

interface SocialSettings {
  id: string | null;
  spaceId: string;
  logoUrl: string | null;
  brandColor: string;
  watermarkPosition: WatermarkPosition;
  showWatermark: boolean;
  defaultFraming: FramingMode;
}

interface SpaceExportItem {
  id: string;
  testimonialId: string;
  format: "tiktok" | "reels" | "shorts";
  outputUrl: string | null;
  status: "pending" | "processing" | "done" | "failed";
  errorMessage: string | null;
  createdAt: string;
  testimonialTitle: string | null;
  customerName: string | null;
  customerCompany: string | null;
  thumbnailUrl: string | null;
}

export default function SpaceSocialPage({ params }: SocialPageProps) {
  const { id: spaceId } = use(params);

  const [settings, setSettings] = useState<SocialSettings>({
    id: null,
    spaceId,
    logoUrl: "",
    brandColor: DEFAULT_BRAND_HEX,
    watermarkPosition: "bottom-right",
    showWatermark: true,
    defaultFraming: "blur",
  });

  const [canRemoveWatermark, setCanRemoveWatermark] = useState(false);
  const [canCustomizeBranding, setCanCustomizeBranding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [exports, setExports] = useState<SpaceExportItem[]>([]);
  const [loadingExports, setLoadingExports] = useState(false);

  useEffect(() => {
    loadSettings();
    loadExports();
  }, [spaceId]);

  async function loadSettings() {
    try {
      setLoading(true);
      const res = await fetch(`/api/spaces/${spaceId}/social-export-settings`);
      if (!res.ok) throw new Error("Failed to load social export settings");
      const data = await res.json();
      if (data.settings) {
        setSettings({
          id: data.settings.id,
          spaceId,
          logoUrl: data.settings.logoUrl || "",
          brandColor: data.settings.brandColor || DEFAULT_BRAND_HEX,
          watermarkPosition: data.settings.watermarkPosition || "bottom-right",
          showWatermark: data.settings.showWatermark ?? true,
          defaultFraming: data.settings.defaultFraming || "blur",
        });
      }
      if (data.limits) {
        setCanRemoveWatermark(Boolean(data.limits.canRemoveWatermark));
        setCanCustomizeBranding(Boolean(data.limits.canCustomizeBranding));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadExports() {
    try {
      setLoadingExports(true);
      const res = await fetch(`/api/spaces/${spaceId}/social-exports`);
      if (!res.ok) return;
      const data = await res.json();
      setExports(data.exports || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingExports(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/spaces/${spaceId}/social-export-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: settings.logoUrl || null,
          brandColor: settings.brandColor,
          watermarkPosition: settings.watermarkPosition,
          showWatermark: canRemoveWatermark ? settings.showWatermark : true,
          defaultFraming: settings.defaultFraming,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to save settings");
      }

      notify.success("Social export branding saved successfully!");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Error saving settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-6xl pb-12">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-medium tracking-tight text-text">
          Social Media Repurposing
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Configure branding, caption overlays, and watermark positioning for vertical 9:16 video exports (TikTok, Reels, Shorts).
        </p>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Settings Form */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleSaveSettings}
            className="rounded-card border bg-surface p-4 sm:p-6 shadow-sm space-y-6"
          >
            <h3 className="text-base font-medium text-text">
              Branding & Export Settings
            </h3>

            {/* Brand Color */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                Brand Accent Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.brandColor}
                  onChange={(e) =>
                    setSettings({ ...settings, brandColor: e.target.value })
                  }
                  className="h-9 w-12 cursor-pointer rounded-control border border-border bg-transparent p-1"
                />
                <input
                  type="text"
                  value={settings.brandColor}
                  onChange={(e) =>
                    setSettings({ ...settings, brandColor: e.target.value })
                  }
                  placeholder={DEFAULT_BRAND_HEX}
                  className={cn(inputClass, "h-9 w-32 text-xs font-mono")}
                />
                <span className="text-xs text-text-muted">
                  Applied to branding headers and accents
                </span>
              </div>
            </div>

            {/* Logo URL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Logo URL (Optional)
                </label>
                {settings.logoUrl && (
                  <span className="text-2xs text-success-foreground font-medium">
                    Logo active
                  </span>
                )}
              </div>
              <input
                type="url"
                value={settings.logoUrl || ""}
                onChange={(e) =>
                  setSettings({ ...settings, logoUrl: e.target.value })
                }
                placeholder="https://yourbrand.com/logo.png"
                className={cn(inputClass, "w-full text-xs")}
              />
              <p className="text-2xs text-text-muted">
                Square or horizontal PNG with transparent background works best.
              </p>
            </div>

            {/* Default Framing */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                Default Vertical Framing
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setSettings({ ...settings, defaultFraming: "blur" })
                  }
                  className={cn("rounded-card border p-3.5 text-left transition-all", toggleStyle("choice", settings.defaultFraming === "blur"))}
                >
                  <div className="font-medium text-xs text-text">
                    Blurred Background
                  </div>
                  <div className="text-2xs text-text-muted mt-0.5">
                    Ambient blurred video fills the 9:16 frame behind the original video
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSettings({ ...settings, defaultFraming: "letterbox" })
                  }
                  className={cn("rounded-card border p-3.5 text-left transition-all", toggleStyle("choice", settings.defaultFraming === "letterbox"))}
                >
                  <div className="font-medium text-xs text-text">
                    Solid Letterbox
                  </div>
                  <div className="text-2xs text-text-muted mt-0.5">
                    Clean black matte framing preserving the original horizontal framing
                  </div>
                </button>
              </div>
            </div>

            {/* Watermark Configuration */}
            <div className="space-y-4 rounded-card border bg-surface-sunken/20 p-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-text-muted">
                  Watermark Position
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      ["bottom-right", "Bottom Right"],
                      ["bottom-left", "Bottom Left"],
                      ["top-right", "Top Right"],
                      ["top-left", "Top Left"],
                    ] as const
                  ).map(([pos, label]) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() =>
                        setSettings({ ...settings, watermarkPosition: pos })
                      }
                      className={cn("rounded-control border px-3 py-2 text-xs font-medium text-center transition-all", toggleStyle("solid", settings.watermarkPosition === pos))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Watermark Removal Toggle */}
              <div className="border-t pt-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-text">
                      Vouchreel Watermark
                    </span>
                    {!canRemoveWatermark && (
                      <span className="rounded-control bg-warning-soft px-2 py-0.5 text-2xs font-medium text-warning-foreground">
                        Free Plan Included
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-text-muted mt-0.5">
                    {canRemoveWatermark
                      ? "Include 'Made with Vouchreel • vouchreel.com' watermark in exported clips"
                      : "Exports on Free plans include watermark attribution. Upgrade to Pro to remove."}
                  </p>
                </div>
                <input
                  type="checkbox"
                  disabled={!canRemoveWatermark}
                  checked={canRemoveWatermark ? settings.showWatermark : true}
                  onChange={(e) =>
                    setSettings({ ...settings, showWatermark: e.target.checked })
                  }
                  className="h-4 w-4 rounded-control border-border-strong text-brand focus:ring-brand disabled:opacity-50"
                />
              </div>

              {!canRemoveWatermark && (
                <div className="pt-1">
                  <Link
                    href="/settings/billing"
                    className={cn(buttonVariants({ variant: "link", size: "bare" }), "text-xs")}
                  >
                    Upgrade to Pro to remove watermark →
                  </Link>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || loading}
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              {saving ? "Saving Changes..." : "Save Export Settings"}
            </button>
          </form>
        </div>

        {/* Live Interactive 9:16 Preview */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-xs space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                Live 9:16 Canvas Preview
              </span>
              <span className="text-2xs text-text-muted">
                1080 × 1920
              </span>
            </div>

            {/* 9:16 Mockup Frame */}
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-card border-4 border-border-strong bg-surface-inverse shadow-float flex flex-col justify-between p-4">
              {/* Simulated Background */}
              {settings.defaultFraming === "blur" ? (
                <div
                  className="absolute inset-0 scale-125 bg-linear-to-br from-surface-inverse to-text-muted opacity-40 blur-lg filter"
                />
              ) : (
                <div className="absolute inset-0 bg-scrim" />
              )}

              {/* Simulated Foreground Video Screen */}
              <div className="absolute inset-x-3 top-1/4 aspect-video rounded-card bg-text-inverse/10 border border-on-media/10 shadow-float flex items-center justify-center overflow-hidden">
                <div className="text-center p-3">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-pill bg-on-media/10 text-on-media mb-2">
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <span className="text-2xs font-medium text-text-inverse">
                    Testimonial Video (16:9)
                  </span>
                </div>
              </div>

              {/* Top Branding Header */}
              <div className="relative z-10 space-y-2 pt-2">
                {settings.logoUrl && (
                  <div className="flex justify-center">
                    <div className="rounded-control bg-scrim/60 px-3 py-1 backdrop-blur-sm border border-on-media/10">
                      <span className="text-2xs font-medium text-on-media tracking-wider uppercase">
                        Brand Logo
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex justify-center">
                  <div
                    className="inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-2xs font-medium text-on-media shadow-xs backdrop-blur-md"
                    style={{
                      backgroundColor: `${settings.brandColor}E6`,
                    }}
                  >
                    <span>Sarah Jenkins</span>
                    <span className="opacity-70">•</span>
                    <span className="opacity-90">CTO at TechFlow</span>
                  </div>
                </div>
              </div>

              {/* Bottom Captions Overlay */}
              <div className="relative z-10 space-y-3 pb-8">
                <div className="mx-auto max-w-[90%] rounded-card bg-scrim/75 p-2.5 text-center backdrop-blur-md border border-on-media/10 shadow-float">
                  <p className="text-2xs font-medium text-on-media leading-relaxed italic">
                    "Vouchreel increased our sales conversions by 48% within 2 weeks of adding the widget!"
                  </p>
                </div>

                {/* Watermark Overlay in selected corner */}
                {(canRemoveWatermark ? settings.showWatermark : true) && (
                  <div
                    className={`absolute flex ${
                      settings.watermarkPosition === "bottom-left"
                        ? "bottom-2 left-2"
                        : settings.watermarkPosition === "top-right"
                        ? "top-2 right-2"
                        : settings.watermarkPosition === "top-left"
                        ? "top-2 left-2"
                        : "bottom-2 right-2"
                    }`}
                  >
                    <div className="rounded-control bg-scrim/70 px-2 py-0.5 text-3xs font-medium text-on-media/90 backdrop-blur-sm border border-on-media/10 shadow-xs">
                      Made with Vouchreel • vouchreel.com
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Space Export History */}
      <div className="rounded-card border bg-surface p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-medium text-text">
              Recent Social Exports
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              All generated vertical clips ready for download across this space.
            </p>
          </div>
          <button
            type="button"
            onClick={loadExports}
            className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-xs")}
          >
            Refresh
          </button>
        </div>

        {loadingExports ? (
          <div className="py-8 text-center text-xs text-text-muted">
            Loading recent exports...
          </div>
        ) : exports.length === 0 ? (
          <div className="rounded-card border border-dashed p-8 text-center text-xs text-text-muted">
            No social exports generated yet. Open any testimonial in the{" "}
            <Link
              href={`/spaces/${spaceId}/testimonials`}
              className={buttonVariants({ variant: "link", size: "bare" })}
            >
              Testimonials
            </Link>{" "}
            tab and click <strong>Export for Social</strong>.
          </div>
        ) : (
          <div className="divide-y overflow-hidden rounded-card border bg-surface">
            {exports.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3 transition-all hover:bg-surface-sunken/40"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex-shrink-0 rounded-control bg-surface-sunken flex items-center justify-center overflow-hidden border">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt="Thumbnail"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <svg
                        className="h-5 w-5 text-text-muted"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </div>

                  <div>
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
                    <p className="text-xs text-text-muted mt-0.5">
                      {item.customerName || item.testimonialTitle || "Testimonial"} •{" "}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {item.status === "done" && item.outputUrl && (
                    <a
                      href={item.outputUrl}
                      download={`vouchreel-${item.format}-${item.id}.mp4`}
                      className={buttonVariants({ variant: "primary", size: "sm" })}
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      Download MP4
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
