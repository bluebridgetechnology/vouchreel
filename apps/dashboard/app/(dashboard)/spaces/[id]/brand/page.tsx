"use client";

import { use, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toggleStyle } from "@/components/ui/toggle";
import { VideoStylePicker } from "@/components/brand/video-style-picker";
import { VideoFontPicker } from "@/components/brand/video-font-picker";
import { VideoPreview } from "@/components/review-video/video-preview";
import { SAMPLE_PROPS, TEMPLATES } from "@vouchreel/video";
import { FormSkeleton, SkeletonRegion } from "@/components/ui/page-skeleton";
import { DEFAULT_BRAND_HEX } from "@/lib/brand";
import { DEFAULT_ACCENT_HEX, MIN_BUTTON_CONTRAST, contrastBetween, type BrandKitValues } from "@/lib/brand-kit/theme";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

const FONT_NAME = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/;
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DEFAULT_ACCENT = DEFAULT_ACCENT_HEX;
const DEFAULT_RADIUS = 12;

const FONT_OPTIONS = [
  {
    id: "inherit",
    title: "Use my site's font",
    hint: "Recommended. The widget picks up whatever font your pages already use.",
  },
  {
    id: "custom",
    title: "A specific font my site loads",
    hint: "Type the font's name, for example Poppins. It must already be loaded by your site.",
  },
  {
    id: "default",
    title: "Vouchreel's default font",
    hint: "A clean system font, the same on every site.",
  },
] as const;

export default function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: spaceId } = use(params);
  const url = `/api/spaces/${spaceId}/brand-kit`;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [initial, setInitial] = useState<BrandKitValues | null>(null);
  const [draft, setDraft] = useState<BrandKitValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState("spotlight");

  useEffect(() => {
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load brand settings.");
        return res.json() as Promise<{ saved: boolean; values: BrandKitValues }>;
      })
      .then((data) => {
        setSaved(data.saved);
        setInitial(data.values);
        setDraft(data.values);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Could not load brand settings."))
      .finally(() => setLoading(false));
  }, [url]);

  const dirty = useMemo(() => Boolean(initial && draft && JSON.stringify(initial) !== JSON.stringify(draft)), [initial, draft]);

  if (loading) {
    return (
      <SkeletonRegion label="Loading brand settings">
        <FormSkeleton fields={4} />
      </SkeletonRegion>
    );
  }
  if (loadError || !draft || !initial) {
    return <p role="alert" className="rounded-card bg-danger-soft p-4 text-sm text-danger-foreground">{loadError ?? "Could not load brand settings."}</p>;
  }

  const set = <K extends keyof BrandKitValues>(key: K, value: BrandKitValues[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  const accent = draft.accentColor ?? DEFAULT_ACCENT;
  const radius = draft.borderRadius ?? DEFAULT_RADIUS;
  const primaryValid = HEX.test(draft.primaryColor);
  const accentValid = !draft.accentColor || HEX.test(draft.accentColor);
  const fontValid = draft.fontMode !== "custom" || FONT_NAME.test(draft.fontFamily ?? "");
  const secondaryValid = !draft.videoSecondaryColor || HEX.test(draft.videoSecondaryColor);
  const secondaryIgnored = draft.videoStyle === "light" || draft.videoStyle === "dark";
  const buttonContrast = primaryValid && accentValid ? contrastBetween(draft.primaryColor, accent) : null;
  const lowContrast = buttonContrast !== null && buttonContrast < MIN_BUTTON_CONTRAST;
  const canSave = dirty && primaryValid && accentValid && fontValid && secondaryValid && !saving;

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const fields = body?.error?.details as Record<string, string[]> | undefined;
        throw new Error(Object.values(fields ?? {})[0]?.[0] ?? body?.error?.message ?? "Could not save brand settings.");
      }
      setInitial(body.values);
      setDraft(body.values);
      setSaved(true);
      notify.success("Brand settings saved. Your widget will use them within a minute.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Could not save brand settings.");
    } finally {
      setSaving(false);
    }
  }

  // The preview approximates the widget: a named font only shows if the dashboard also loads it
  const previewFont = draft.fontMode === "custom" && fontValid && draft.fontFamily ? `"${draft.fontFamily}", sans-serif` : undefined;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-2 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-text">Brand</h2>
          <p className="text-sm text-text-muted">
            Set your colours and fonts once. Your widget uses them, and review videos start from your brand colour.
          </p>
        </div>
        {!saved && <Badge variant="info">Not saved yet: your widget still uses its current look</Badge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* Colours */}
          <Card as="section" variant="flat" className="space-y-5 p-5" aria-labelledby="brand-colours">
            <h3 id="brand-colours" className="text-sm font-medium text-text">
              Colours
            </h3>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="brand-primary" className="text-xs font-medium text-text">
                  Primary colour
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="brand-primary"
                    type="color"
                    value={primaryValid ? draft.primaryColor : DEFAULT_BRAND_HEX}
                    onChange={(e) => set("primaryColor", e.target.value)}
                    className="size-10 shrink-0 cursor-pointer rounded-control border bg-surface p-1"
                    aria-label="Primary colour"
                  />
                  <input
                    value={draft.primaryColor}
                    onChange={(e) => set("primaryColor", e.target.value)}
                    maxLength={7}
                    aria-label="Primary colour hex"
                    aria-invalid={!primaryValid}
                    className={cn(inputClass, "w-28 font-mono text-xs", !primaryValid && "border-danger")}
                  />
                </div>
                <p className="text-xs text-text-muted">Buttons, highlights and the star rating accents.</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="brand-accent" className="text-xs font-medium text-text">
                  Text on primary colour
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="brand-accent"
                    type="color"
                    value={accentValid ? accent : DEFAULT_ACCENT}
                    onChange={(e) => set("accentColor", e.target.value)}
                    className="size-10 shrink-0 cursor-pointer rounded-control border bg-surface p-1"
                    aria-label="Text colour on the primary colour"
                  />
                  <input
                    value={draft.accentColor ?? ""}
                    placeholder="Automatic"
                    onChange={(e) => set("accentColor", e.target.value.trim() === "" ? null : e.target.value)}
                    maxLength={7}
                    aria-label="Text on primary colour hex"
                    aria-invalid={!accentValid}
                    className={cn(inputClass, "w-28 font-mono text-xs", !accentValid && "border-danger")}
                  />
                </div>
                <p className={cn("text-xs", lowContrast ? "text-warning-foreground" : "text-text-muted")}>
                  {lowContrast
                    ? `Low contrast (${buttonContrast!.toFixed(1)}:1). Text on your buttons may be hard to read; aim for ${MIN_BUTTON_CONTRAST}:1 or more.`
                    : "Leave empty to use white."}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="brand-radius" className="text-xs font-medium text-text">
                  Corner radius
                </label>
                <span className="text-xs tabular-nums text-text-muted">{radius}px</span>
              </div>
              <input
                id="brand-radius"
                type="range"
                min={0}
                max={24}
                step={1}
                value={radius}
                onChange={(e) => set("borderRadius", Number(e.target.value))}
                className="w-full accent-(--user-accent)"
                style={{ "--user-accent": primaryValid ? draft.primaryColor : DEFAULT_BRAND_HEX } as React.CSSProperties}
              />
              <div className="flex items-center justify-between text-xs text-text-muted">
                <span>Sharp</span>
                <button type="button" onClick={() => set("borderRadius", null)} className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-xs")}>
                  Use the default
                </button>
                <span>Pill</span>
              </div>
            </div>
          </Card>

          {/* Typography */}
          <Card as="section" variant="flat" className="space-y-4 p-5" aria-labelledby="brand-fonts">
            <div>
              <h3 id="brand-fonts" className="text-sm font-medium text-text">
                Fonts
              </h3>
              <p className="text-xs text-text-muted">Vouchreel never loads fonts on your site. It uses the ones your pages already have.</p>
            </div>

            <div role="radiogroup" aria-label="Font" className="space-y-2">
              {FONT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={draft.fontMode === option.id}
                  onClick={() => set("fontMode", option.id)}
                  className={cn("w-full rounded-card border p-3 text-left transition-all", toggleStyle("choice", draft.fontMode === option.id))}
                >
                  <span className="block text-sm font-medium">{option.title}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">{option.hint}</span>
                </button>
              ))}
            </div>

            {draft.fontMode === "custom" && (
              <div className="space-y-1.5">
                <label htmlFor="brand-font-name" className="text-xs font-medium text-text">
                  Font name
                </label>
                <input
                  id="brand-font-name"
                  value={draft.fontFamily ?? ""}
                  onChange={(e) => set("fontFamily", e.target.value)}
                  placeholder="Poppins"
                  maxLength={40}
                  aria-invalid={!fontValid}
                  aria-describedby="brand-font-help"
                  className={cn(inputClass, "max-w-xs", !fontValid && "border-danger")}
                />
                <p id="brand-font-help" className={cn("text-xs", fontValid ? "text-text-muted" : "text-danger-foreground")}>
                  {fontValid ? "Letters, numbers, spaces and hyphens only. If your site does not load this font, the widget falls back to the default." : "Use the font name only, for example Poppins or Open Sans."}
                </p>
              </div>
            )}

            <div className="flex items-start justify-between gap-4 border-t pt-4">
              <div>
                <label htmlFor="brand-text-colour" className="text-sm font-medium text-text">
                  Use my site's text colour
                </label>
                <p className="mt-0.5 text-xs text-text-muted">
                  Only applied when it stays easy to read on the widget. If your site uses light text on a dark page, the widget keeps its own colour instead of
                  becoming unreadable.
                </p>
              </div>
              <Switch id="brand-text-colour" checked={draft.inheritTextColor} onCheckedChange={(v) => set("inheritTextColor", v)} aria-label="Use my site's text colour" />
            </div>
          </Card>

          {/* Review videos */}
          <Card as="section" variant="flat" className="space-y-4 p-5" aria-labelledby="brand-video">
            <div>
              <h3 id="brand-video" className="text-sm font-medium text-text">
                Review videos
              </h3>
              <p className="text-xs text-text-muted">
                Your primary colour is the video background colour. Pick the look; you can change it for any single video. Text colour is chosen automatically so it is always easy
                to read, even on light colours.
              </p>
            </div>

            <VideoStylePicker
              label="Video background style"
              brand={draft.primaryColor}
              secondary={draft.videoSecondaryColor}
              value={draft.videoStyle}
              onChange={(style) => set("videoStyle", style)}
              defaultOption={{ title: "Each template's own", hint: "Every template keeps its signature look" }}
            />

            <div className="space-y-2 border-t pt-4">
              <span id="brand-video-font-label" className="text-xs font-medium text-text">
                Video font
              </span>
              <p className="text-xs text-text-muted">The type used for the review text in your videos. Longer reviews fit less in wider fonts, and a review too long for the font is cut at a word with “…”.</p>
              <VideoFontPicker
                label="Video font"
                value={draft.videoFont}
                onChange={(font) => set("videoFont", font)}
                defaultOption={{ title: "Each template's own", hint: "Outfit, with an elegant serif quote in Minimal" }}
              />
            </div>

            <div className="space-y-2 border-t pt-4">
              <label htmlFor="brand-video-second" className="text-xs font-medium text-text">
                Second colour (optional)
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="brand-video-second"
                  type="color"
                  value={draft.videoSecondaryColor && secondaryValid ? draft.videoSecondaryColor : primaryValid ? draft.primaryColor : DEFAULT_BRAND_HEX}
                  onChange={(e) => set("videoSecondaryColor", e.target.value)}
                  disabled={secondaryIgnored}
                  className="size-10 shrink-0 cursor-pointer rounded-control border bg-surface p-1 disabled:opacity-50"
                  aria-label="Second colour"
                />
                <input
                  value={draft.videoSecondaryColor ?? ""}
                  placeholder="None"
                  onChange={(e) => set("videoSecondaryColor", e.target.value.trim() === "" ? null : e.target.value)}
                  disabled={secondaryIgnored}
                  maxLength={7}
                  aria-label="Second colour hex"
                  aria-invalid={!secondaryValid}
                  className={cn(inputClass, "w-28 font-mono text-xs", !secondaryValid && "border-danger")}
                />
              </div>
              <p className="text-xs text-text-muted">
                {secondaryIgnored
                  ? "Light and Dark backgrounds are built from your primary colour only."
                  : "The far end of the gradient and one of the aurora glows. Leave empty to use a deeper shade of your primary colour."}
              </p>
            </div>
          </Card>

          <div className="flex items-center gap-3">
            <Button type="button" onClick={save} loading={saving} disabled={!canSave}>
              Save brand settings
            </Button>
            {dirty && (
              <button type="button" onClick={() => setDraft(initial)} className={buttonVariants({ variant: "link-muted", size: "bare" })}>
                Discard changes
              </button>
            )}
          </div>
        </div>

        {/* Preview + where it applies */}
        <aside className="space-y-4 lg:col-span-2">
          <div className="sticky top-6 space-y-4">
            <Card variant="flat" className="bg-surface-sunken/50 p-5">
              <p className="mb-3 text-xs font-medium text-text">Preview</p>
              <div
                className="border bg-surface p-4 shadow-sm"
                style={{ borderRadius: radius, fontFamily: previewFont }}
              >
                <div className="flex items-center gap-1 text-warning-foreground" aria-hidden>
                  {"★★★★★"}
                </div>
                <p className="mt-2 text-sm text-text">“Setup took ten minutes and support answered every question.”</p>
                <p className="mt-1 text-xs text-text-muted">Maya Okafor</p>
                <span
                  className="mt-4 inline-block px-4 py-2 text-xs font-medium"
                  style={{
                    backgroundColor: primaryValid ? draft.primaryColor : DEFAULT_BRAND_HEX,
                    color: accentValid ? accent : DEFAULT_ACCENT,
                    borderRadius: Math.max(4, radius - 4),
                  }}
                >
                  Read more reviews
                </span>
              </div>
              <p className="mt-3 text-xs text-text-muted">
                {draft.fontMode === "inherit"
                  ? "On your site the widget will use your site's font. This preview uses the dashboard font."
                  : draft.fontMode === "custom"
                    ? "A custom font only shows here if the dashboard has it too. On your site it uses your font."
                    : "The widget uses Vouchreel's default font."}
              </p>
            </Card>

            <Card variant="flat" className="bg-surface-sunken/50 p-5">
              <p className="mb-3 text-xs font-medium text-text">Video preview</p>
              <div role="radiogroup" aria-label="Preview template" className="mb-3 flex flex-wrap gap-1.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={previewTemplate === t.id}
                    onClick={() => setPreviewTemplate(t.id)}
                    className={cn("rounded-control border px-2.5 py-1 text-2xs font-medium", toggleStyle("choice", previewTemplate === t.id))}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mx-auto max-w-[210px]">
                <VideoPreview
                  templateId={previewTemplate}
                  aspect="9:16"
                  props={{
                    ...SAMPLE_PROPS[previewTemplate],
                    brand: primaryValid ? draft.primaryColor : DEFAULT_BRAND_HEX,
                    ...(draft.videoStyle || draft.videoFont || (draft.videoSecondaryColor && secondaryValid)
                      ? {
                          theme: {
                            ...(draft.videoStyle ? { style: draft.videoStyle } : {}),
                            ...(draft.videoFont ? { font: draft.videoFont } : {}),
                            ...(draft.videoSecondaryColor && secondaryValid ? { secondary: draft.videoSecondaryColor } : {}),
                          },
                        }
                      : {}),
                  }}
                />
              </div>
              <p className="mt-3 text-xs text-text-muted">The real template with sample text, in your colour, style and font. Press play to see it animate.</p>
            </Card>

            <Card variant="flat" className="p-5 text-xs text-text-muted">
              <p className="mb-2 text-xs font-medium text-text">Where this applies</p>
              <ul className="space-y-1.5">
                <li>
                  <span className="font-medium text-text">Widget:</span> colours, corner radius, fonts and text colour.
                </li>
                <li>
                  <span className="font-medium text-text">Review videos:</span> the primary colour and the style you pick above are the default for every new video.
                </li>
                <li>
                  <span className="font-medium text-text">Light or dark mode</span> stays in the Widget tab.
                </li>
              </ul>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}
