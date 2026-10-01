"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  PLATFORM_PRESETS,
  type FramingMode,
  type WatermarkPosition,
} from "@/lib/social/presets";

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
    brandColor: "#6366f1",
    watermarkPosition: "bottom-right",
    showWatermark: true,
    defaultFraming: "blur",
  });

  const [canRemoveWatermark, setCanRemoveWatermark] = useState(false);
  const [canCustomizeBranding, setCanCustomizeBranding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

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
          brandColor: data.settings.brandColor || "#6366f1",
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
    setMessage(null);

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

      setMessage({ text: "Social export branding saved successfully!", type: "success" });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Error saving settings",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-6xl pb-12">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Social Media Repurposing
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure branding, caption overlays, and watermark positioning for vertical 9:16 video exports (TikTok, Reels, Shorts).
        </p>
      </div>

      {message && (
        <div
          role="status"
          className={`rounded-xl border p-4 text-xs font-semibold ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Settings Form */}
        <div className="lg:col-span-7 space-y-6">
          <form
            onSubmit={handleSaveSettings}
            className="rounded-2xl border bg-card p-6 shadow-sm space-y-6"
          >
            <h3 className="text-base font-bold text-foreground">
              Branding & Export Settings
            </h3>

            {/* Brand Color */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Brand Accent Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={settings.brandColor}
                  onChange={(e) =>
                    setSettings({ ...settings, brandColor: e.target.value })
                  }
                  className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent p-1"
                />
                <input
                  type="text"
                  value={settings.brandColor}
                  onChange={(e) =>
                    setSettings({ ...settings, brandColor: e.target.value })
                  }
                  placeholder="#6366f1"
                  className="h-9 w-32 rounded-lg border border-input bg-background px-3 text-xs font-mono"
                />
                <span className="text-xs text-muted-foreground">
                  Applied to branding headers and accents
                </span>
              </div>
            </div>

            {/* Logo URL */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Logo URL (Optional)
                </label>
                {settings.logoUrl && (
                  <span className="text-[11px] text-emerald-600 font-medium">
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
                className="w-full rounded-lg border border-input bg-background px-3.5 py-2 text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Square or horizontal PNG with transparent background works best.
              </p>
            </div>

            {/* Default Framing */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Default Vertical Framing
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setSettings({ ...settings, defaultFraming: "blur" })
                  }
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    settings.defaultFraming === "blur"
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="font-semibold text-xs text-foreground">
                    Blurred Background
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Ambient blurred video fills the 9:16 frame behind the original video
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setSettings({ ...settings, defaultFraming: "letterbox" })
                  }
                  className={`rounded-xl border p-3.5 text-left transition-all ${
                    settings.defaultFraming === "letterbox"
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="font-semibold text-xs text-foreground">
                    Solid Letterbox
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Clean black matte framing preserving the original horizontal framing
                  </div>
                </button>
              </div>
            </div>

            {/* Watermark Configuration */}
            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
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
                      className={`rounded-lg border px-3 py-2 text-xs font-medium text-center transition-all ${
                        settings.watermarkPosition === pos
                          ? "border-primary bg-primary text-primary-foreground font-bold"
                          : "border-border bg-card text-foreground hover:bg-muted"
                      }`}
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
                    <span className="text-xs font-bold text-foreground">
                      Vouchreel Watermark
                    </span>
                    {!canRemoveWatermark && (
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        Free Plan Included
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
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
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-50"
                />
              </div>

              {!canRemoveWatermark && (
                <div className="pt-1">
                  <Link
                    href="/settings/billing"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Upgrade to Pro to remove watermark →
                  </Link>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-xs font-bold text-primary-foreground shadow hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving Changes..." : "Save Export Settings"}
            </button>
          </form>
        </div>

        {/* Live Interactive 9:16 Preview */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-xs space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Live 9:16 Canvas Preview
              </span>
              <span className="text-[11px] text-muted-foreground">
                1080 × 1920
              </span>
            </div>

            {/* 9:16 Mockup Frame */}
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border-4 border-slate-900 bg-slate-950 shadow-2xl flex flex-col justify-between p-4">
              {/* Simulated Background */}
              {settings.defaultFraming === "blur" ? (
                <div
                  className="absolute inset-0 bg-cover bg-center filter blur-lg opacity-40 scale-125"
                  style={{
                    backgroundImage:
                      "linear-gradient(45deg, #1e293b, #334155, #475569)",
                  }}
                />
              ) : (
                <div className="absolute inset-0 bg-black" />
              )}

              {/* Simulated Foreground Video Screen */}
              <div className="absolute inset-x-3 top-1/4 aspect-video rounded-xl bg-slate-800/80 border border-white/10 shadow-lg flex items-center justify-center overflow-hidden">
                <div className="text-center p-3">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white mb-2">
                    <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-200">
                    Testimonial Video (16:9)
                  </span>
                </div>
              </div>

              {/* Top Branding Header */}
              <div className="relative z-10 space-y-2 pt-2">
                {settings.logoUrl && (
                  <div className="flex justify-center">
                    <div className="rounded-lg bg-black/60 px-3 py-1 backdrop-blur-sm border border-white/10">
                      <span className="text-[11px] font-bold text-white tracking-wider uppercase">
                        Brand Logo
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex justify-center">
                  <div
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold text-white shadow backdrop-blur-md"
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
                <div className="mx-auto max-w-[90%] rounded-xl bg-black/75 p-2.5 text-center backdrop-blur-md border border-white/10 shadow-lg">
                  <p className="text-[11px] font-semibold text-white leading-relaxed italic">
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
                    <div className="rounded-md bg-black/70 px-2 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-sm border border-white/10 shadow">
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
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">
              Recent Social Exports
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              All generated vertical clips ready for download across this space.
            </p>
          </div>
          <button
            type="button"
            onClick={loadExports}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Refresh
          </button>
        </div>

        {loadingExports ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Loading recent exports...
          </div>
        ) : exports.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground">
            No social exports generated yet. Open any testimonial in the{" "}
            <Link
              href={`/spaces/${spaceId}/testimonials`}
              className="font-bold text-primary hover:underline"
            >
              Testimonials
            </Link>{" "}
            tab and click <strong>Export for Social</strong>.
          </div>
        ) : (
          <div className="divide-y overflow-hidden rounded-xl border bg-background">
            {exports.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-3 transition-all hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 flex-shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                    {item.thumbnailUrl ? (
                      <img
                        src={item.thumbnailUrl}
                        alt="Thumbnail"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <svg
                        className="h-5 w-5 text-muted-foreground"
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
                      <span className="font-bold text-xs text-foreground uppercase">
                        {item.format}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${
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
                    <p className="text-xs text-muted-foreground mt-0.5">
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
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow hover:opacity-90 flex items-center gap-1.5"
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
