"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { rightsTextFor } from "@/lib/review-video/rights";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_BRAND_HEX } from "@/lib/brand";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirm } from "@/components/ui/confirm";
import { Icon } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/input";
import { ModalOverlay } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { VideoStylePicker } from "@/components/brand/video-style-picker";
import { VideoFontPicker } from "@/components/brand/video-font-picker";
import { WidgetVideoSwitch } from "@/components/review-video/widget-switch";
import { VideoPreview } from "@/components/review-video/video-preview";
import { previewProps } from "@/lib/review-video/preview";
import { STYLES, getVideoFont, type BackgroundStyle, type VideoFontId } from "@vouchreel/video";
import { toggleStyle } from "@/components/ui/toggle";
import { summarizeCredits, type CreditsView } from "@/lib/ai-video/ui-state";
import {
  STATUS_LABELS,
  checkSelection,
  estimateSeconds,
  isInFlight,
  posterSrc,
  pruneSelection,
  reviewPickState,
  shouldPoll,
  templateBlockedReason,
  toggleSelection,
  type ReviewOptionView,
  type ReviewVideoView,
  type SourceStatsView,
  type TemplateView,
} from "@/lib/review-video/ui-state";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { cardVariants } from "@/components/ui/card";

interface Loaded {
  videos: ReviewVideoView[];
  reviews: ReviewOptionView[];
  stats: SourceStatsView[];
  templates: TemplateView[];
  credits: CreditsView;
  defaultBrand: string;
  /** The brand kit's video defaults, shown as the meaning of "brand default". */
  brandStyle: BackgroundStyle | null;
  brandSecondary: string | null;
  brandFont: VideoFontId | null;
}

const SOURCE_NAMES = { google: "Google", trustpilot: "Trustpilot", own: "Added by you" } as const;
const STATUS_BADGE = { queued: "info", rendering: "info", done: "success", failed: "danger" } as const;

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

export function ReviewVideoModal({ spaceId, onClose }: { spaceId: string; onClose: () => void }) {
  const confirm = useConfirm();
  const url = `/api/spaces/${spaceId}/review-videos`;

  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<"create" | "videos">("create");

  const [templateId, setTemplateId] = useState("spotlight");
  const [aspect, setAspect] = useState<"9:16" | "16:9">("9:16");
  const [selected, setSelected] = useState<string[]>([]);
  const [brand, setBrand] = useState(DEFAULT_BRAND_HEX);
  // null = the brand kit's default style; secondary: undefined = the brand default, null = none, string = this colour
  const [style, setStyle] = useState<BackgroundStyle | null>(null);
  const [secondary, setSecondary] = useState<string | null | undefined>(undefined);
  // null = the brand kit's default font (then each template's own typography)
  const [font, setFont] = useState<VideoFontId | null>(null);
  const effectiveFont = font ?? data?.brandFont ?? null;
  const [rights, setRights] = useState(false);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(
    async (initial = false) => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(await readError(res, "Could not load review videos."));
        const next = (await res.json()) as Loaded;
        setData(next);
        setLoadError(null);
        if (initial) {
          setBrand(next.defaultBrand);
          setTemplateId(next.templates[0]?.id ?? "spotlight");
          if (next.videos.some((v) => isInFlight(v.status))) setTab("videos");
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Could not load review videos.");
      }
    },
    [url],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  // Check on videos being created, only while this dialog is open
  const polling = data ? shouldPoll(data.videos) : false;
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [polling, load]);

  const template = data?.templates.find((t) => t.id === templateId) ?? null;
  const credits = data ? summarizeCredits(data.credits) : null;
  const picked = useMemo(
    () => (data ? selected.map((id) => data.reviews.find((r) => r.id === id)).filter((r): r is ReviewOptionView => Boolean(r)) : []),
    [data, selected],
  );
  const check = template ? checkSelection(template, selected, rights) : null;
  const seconds = data && template ? estimateSeconds(template, picked, data.stats) : null;
  const rightsText = rightsTextFor(picked.map((r) => r.source));
  const livePreview = useMemo(
    () =>
      data && template
        ? previewProps({ template, picked, stats: data.stats, brand, style, brandStyle: data.brandStyle, secondary, brandSecondary: data.brandSecondary, font, brandFont: data.brandFont })
        : null,
    [data, template, picked, brand, style, secondary, font],
  );
  const blocked = data && template ? templateBlockedReason(template, data.stats, data.reviews, effectiveFont) : null;

  function chooseTemplate(next: TemplateView) {
    if (!data) return;
    setTemplateId(next.id);
    setSelected((current) => pruneSelection(current, next, data.reviews, effectiveFont));
    setActionError(null);
  }

  function chooseFont(next: VideoFontId | null) {
    if (!data || !template) return;
    setFont(next);
    // A wider font fits fewer characters, so a pick that no longer fits is dropped
    const kept = pruneSelection(selected, template, data.reviews, next ?? data.brandFont);
    if (kept.length < selected.length) notify.info("Some picked reviews are too long for that font and were removed.");
    setSelected(kept);
  }

  async function create() {
    if (!template) return;
    setCreating(true);
    setActionError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: template.id,
          aspect,
          reviewIds: selected,
          brandColor: brand,
          ...(style ? { style } : {}),
          ...(font ? { font } : {}),
          ...(secondary !== undefined ? { secondaryColor: secondary } : {}),
          rightsConfirmed: rights,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not create the video."));
      const { video } = (await res.json()) as { video: ReviewVideoView };
      await load();
      setSelected([]);
      setActiveId(video.id);
      setTab("videos");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not create the video.");
    } finally {
      setCreating(false);
    }
  }

  async function remove(video: ReviewVideoView) {
    const ok = await confirm({
      title: "Delete this video?",
      description: video.status === "done" ? "The video will be removed. The credit you used is not refunded." : "Nothing was charged.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`${url}/${video.id}`, { method: "DELETE" });
    if (!res.ok) {
      notify.error(await readError(res, "Could not delete the video."));
      return;
    }
    if (activeId === video.id) setActiveId(null);
    await load();
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      notify.success("Link copied.");
    } catch {
      notify.error("Could not copy the link.");
    }
  }

  const videoCount = data?.videos.length ?? 0;
  const templateLabel = (id: string) => data?.templates.find((t) => t.id === id)?.label ?? id;

  return (
    <ModalOverlay label="Review videos" onClose={onClose}>
      <Card variant="flat" className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden shadow-float">
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-control bg-brand-soft text-brand">
                <Icon name="play-circle" size="sm" />
              </span>
              <h3 className="text-lg font-medium text-text">Review videos</h3>
            </div>
            <p className="mt-0.5 text-xs text-text-muted">Turn your Google and Trustpilot reviews into styled, shareable videos. Reviews are shown exactly as written.</p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <Icon name="close" size="sm" />
          </Button>
        </div>

        <div className="flex border-b px-6">
          {([
            ["create", "Create"],
            ["videos", `Your videos${videoCount ? ` (${videoCount})` : ""}`],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn("px-4 py-2.5 text-xs font-medium transition-all", toggleStyle("tab", tab === id))}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {loadError && (
            <p role="alert" className="rounded-card bg-danger-soft p-3.5 text-xs text-danger-foreground">
              {loadError}{" "}
              <button type="button" onClick={() => void load(true)} className={buttonVariants({ variant: "link", size: "bare" })}>
                Try again
              </button>
            </p>
          )}
          {!data && !loadError && (
            <div className="flex justify-center py-12">
              <Spinner label="Loading" />
            </div>
          )}

          {data && template && credits && tab === "create" && (
            <>
              {data.reviews.length === 0 ? (
                <Card variant="flat" className="flex gap-3 bg-surface-sunken/40 p-4 text-xs text-text-muted">
                  <Icon name="info-circle" className="mt-0.5" />
                  <p>
                    <span className="block text-sm font-medium text-text">No reviews to use yet</span>
                    Connect Google or Trustpilot on this page and sync. Reviews with text will appear here.
                  </p>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_250px]">
                  <div className="min-w-0 space-y-6">
                  {actionError && (
                    <p role="alert" className="rounded-card bg-danger-soft p-3.5 text-xs text-danger-foreground">
                      {actionError}
                    </p>
                  )}

                  <fieldset className="space-y-2">
                    <legend className="text-xs font-medium text-text">Template</legend>
                    <div role="radiogroup" aria-label="Template" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {data.templates.map((t) => {
                        const reason = templateBlockedReason(t, data.stats, data.reviews, effectiveFont);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            role="radio"
                            aria-checked={templateId === t.id}
                            aria-disabled={Boolean(reason)}
                            onClick={() => chooseTemplate(t)}
                            title={reason ?? t.description}
                            className={cn(
                              "rounded-card border p-1.5 text-left transition-all",
                              toggleStyle("choice", templateId === t.id),
                              reason && "opacity-55",
                            )}
                          >
                            <img src={`/video-previews/${t.id}.jpg`} alt="" width={180} height={320} className="aspect-[9/16] w-full rounded-control object-cover" loading="lazy" />
                            <span className="mt-1.5 block px-1 text-xs font-medium">{t.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-text-muted">
                      {template.description} Previews use sample text.
                      {blocked && <span className="mt-1 block text-warning-foreground">{blocked}</span>}
                    </p>
                  </fieldset>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <fieldset className="space-y-2">
                      <legend className="text-xs font-medium text-text">Shape</legend>
                      <div role="radiogroup" aria-label="Shape" className="grid gap-2">
                        {(["9:16", "16:9"] as const).map((a) => (
                          <button
                            key={a}
                            type="button"
                            role="radio"
                            aria-checked={aspect === a}
                            onClick={() => setAspect(a)}
                            className={cn("rounded-control border px-3 py-2 text-left text-xs font-medium", toggleStyle("choice", aspect === a))}
                          >
                            {a === "9:16" ? "Vertical 9:16 (Reels, TikTok, Shorts)" : "Landscape 16:9 (websites, YouTube)"}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <div className="space-y-2">
                      <label htmlFor="rv-brand" className="text-xs font-medium text-text">
                        Brand colour
                      </label>
                      <div className="flex items-center gap-3">
                        <input id="rv-brand" type="color" value={brand} onChange={(e) => setBrand(e.target.value)} className="size-10 shrink-0 cursor-pointer rounded-control border bg-surface p-1" aria-label="Brand colour" />
                        <input value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={7} aria-label="Brand colour hex" className={cn(inputClass, "w-28 font-mono text-xs")} />
                      </div>
                      <p className="text-xs text-text-muted">The text colour adjusts automatically, so it stays easy to read on any colour.</p>
                    </div>
                  </div>

                  <fieldset className="space-y-3">
                    <legend className="text-xs font-medium text-text">Font</legend>
                    <VideoFontPicker
                      label="Video font"
                      value={font}
                      onChange={chooseFont}
                      defaultOption={{
                        title: data.brandFont ? `Brand default: ${getVideoFont(data.brandFont).label}` : "Template's own type",
                        hint: data.brandFont ? "Set on your Brand page" : "Each template keeps its signature type",
                      }}
                    />
                  </fieldset>

                  <fieldset className="space-y-3">
                    <legend className="text-xs font-medium text-text">Background</legend>
                    <VideoStylePicker
                      label="Background style"
                      brand={brand}
                      secondary={secondary === undefined ? data.brandSecondary : secondary}
                      value={style}
                      onChange={setStyle}
                      defaultOption={{
                        title: data.brandStyle ? `Brand default: ${STYLES.find((s) => s.id === data.brandStyle)?.label ?? data.brandStyle}` : "Template's own look",
                        hint: data.brandStyle ? "Set on your Brand page" : "Each template keeps its signature look",
                      }}
                    />
                    {(style ?? data.brandStyle) !== "light" && (style ?? data.brandStyle) !== "dark" && (
                      <div className="space-y-1.5">
                        <span id="rv-second-label" className="text-xs font-medium text-text">
                          Second colour
                        </span>
                        <div role="radiogroup" aria-labelledby="rv-second-label" className="flex flex-wrap items-center gap-2">
                          {(
                            [
                              ["default", "Brand default"],
                              ["none", "None"],
                              ["custom", "Pick a colour"],
                            ] as const
                          ).map(([mode, label]) => {
                            const active = mode === "default" ? secondary === undefined : mode === "none" ? secondary === null : typeof secondary === "string";
                            return (
                              <button
                                key={mode}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => setSecondary(mode === "default" ? undefined : mode === "none" ? null : (data.brandSecondary ?? brand))}
                                className={cn("rounded-control border px-3 py-1.5 text-xs font-medium", toggleStyle("choice", active))}
                              >
                                {label}
                              </button>
                            );
                          })}
                          {typeof secondary === "string" && (
                            <input
                              type="color"
                              value={/^#[0-9a-fA-F]{6}$/.test(secondary) ? secondary : brand}
                              onChange={(e) => setSecondary(e.target.value)}
                              className="size-9 cursor-pointer rounded-control border bg-surface p-1"
                              aria-label="Second colour"
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </fieldset>

                  <fieldset className="space-y-2">
                    <legend className="text-xs font-medium text-text">
                      {template.reviews.max === 1 ? "Pick a review" : `Pick ${template.reviews.min} to ${template.reviews.max} reviews, in the order they should appear`}
                    </legend>
                    <ul className="max-h-72 divide-y overflow-y-auto rounded-card border">
                      {data.reviews.map((review) => {
                        const state = reviewPickState(review, template, selected, effectiveFont);
                        const index = selected.indexOf(review.id);
                        return (
                          <li key={review.id}>
                            <button
                              type="button"
                              disabled={state.disabled}
                              onClick={() => setSelected((s) => toggleSelection(s, review.id, template))}
                              aria-pressed={index >= 0}
                              title={state.reason ?? undefined}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "bare" }),
                                "w-full items-start justify-start gap-3 rounded-none px-3 py-3 text-left text-xs",
                                index >= 0 && "bg-brand-soft/50",
                                state.disabled && "opacity-50",
                              )}
                            >
                              <span
                                className={cn(
                                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-pill border text-2xs font-medium",
                                  index >= 0 ? "border-brand bg-brand text-text-on-accent" : "border-field-border",
                                )}
                                aria-hidden
                              >
                                {index >= 0 ? index + 1 : ""}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium text-text">{review.author}</span>
                                  {review.rating != null && (
                                    <span className="text-warning-foreground" aria-label={`${review.rating} stars`}>
                                      {"★".repeat(review.rating)}
                                      <span className="text-border-strong">{"★".repeat(5 - review.rating)}</span>
                                    </span>
                                  )}
                                  <Badge variant="neutral">{SOURCE_NAMES[review.source]}</Badge>
                                  {review.date && <span className="text-text-muted">{review.date}</span>}
                                </span>
                                <span className="mt-1 line-clamp-2 block font-normal text-text-muted">{review.text}</span>
                                {state.reason && <span className="mt-1 block text-2xs text-text-muted">{state.reason}</span>}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </fieldset>

                  <label className={cn(cardVariants({ variant: "flat" }), "flex items-start gap-3 bg-surface-sunken/40 p-4 text-xs text-text-muted")}>
                    <Checkbox checked={rights} onCheckedChange={(v) => setRights(v === true)} className="mt-0.5" />
                    <span>
                      <span className="font-medium text-text">{rightsText.headline}</span> {rightsText.detail}
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <p className="text-xs text-text-muted">
                      {credits.text}.{seconds !== null && ` About ${Math.round(seconds)} seconds long.`}
                      {check && !check.ready && !credits.blocked && <span className="block text-text">{check.message}</span>}
                    </p>
                    <Button type="button" onClick={create} loading={creating} disabled={!check?.ready || credits.blocked || Boolean(blocked)}>
                      Create video
                    </Button>
                  </div>
                  {credits.blocked && <p className="text-xs text-danger-foreground">{credits.text}</p>}
                  </div>

                  {/* Live preview: the real template, in the colours and style chosen, updating as you choose */}
                  {livePreview && (
                    <aside className="md:sticky md:top-0 md:self-start" aria-label="Live preview">
                      <p className="mb-2 text-xs font-medium text-text">Live preview</p>
                      <VideoPreview templateId={template.id} aspect={aspect} props={livePreview.props} />
                      <p className="mt-2 text-xs text-text-muted">
                        {livePreview.usingSample ? "Showing sample text. Pick a review to see yours." : "Showing your selected review."} Press play to see it animate.
                      </p>
                    </aside>
                  )}
                </div>
              )}
            </>
          )}

          {data && tab === "videos" && (
            <>
              {data.videos.length === 0 ? (
                <p className="py-10 text-center text-sm text-text-muted">No videos yet. Create one from the Create tab.</p>
              ) : (
                <ul className="space-y-4">
                  {data.videos.map((video) => (
                    <li key={video.id} className={cn("rounded-card border p-4", video.id === activeId && "border-brand")}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs">
                          <span className="font-medium text-text">
                            {templateLabel(video.template)} · {video.aspect}
                          </span>
                          <span className="block text-text-muted">{new Date(video.createdAt).toLocaleString()}</span>
                        </div>
                        {video.moderatedAt ? <Badge variant="neutral">Removed</Badge> : <Badge variant={STATUS_BADGE[video.status]}>{STATUS_LABELS[video.status]}</Badge>}
                      </div>

                      {isInFlight(video.status) && (
                        <div className="mt-4 flex items-center gap-3 text-xs text-text-muted" aria-live="polite">
                          <Spinner label="Creating your video" />
                          {video.status === "queued" ? "Waiting for a free slot…" : "Creating your video…"} You can close this window; we'll notify you when it's ready.
                        </div>
                      )}

                      {video.status === "done" && video.outputUrl && (
                        <div className="mt-4 space-y-3">
                          <video
                            controls
                            playsInline
                            preload="metadata"
                            src={posterSrc(video.outputUrl, video.durationSeconds)}
                            className={cn("mx-auto rounded-card bg-scrim", video.aspect === "9:16" ? "max-h-[50vh] w-auto" : "w-full")}
                          />
                          <WidgetVideoSwitch endpoint={`${url}/${video.id}/widget`} checked={Boolean(video.showInWidget)} onChanged={load} />
                          <div className="flex flex-wrap justify-center gap-2">
                            <a href={video.outputUrl} download className={buttonVariants({ variant: "primary", size: "sm" })}>
                              Download
                            </a>
                            <Button type="button" variant="outline" size="sm" onClick={() => void copyLink(video.outputUrl!)}>
                              <Icon name="copy" size="sm" />
                              Copy link
                            </Button>
                            <Button type="button" variant="ghost-danger" size="sm" onClick={() => void remove(video)}>
                              Delete
                            </Button>
                          </div>
                        </div>
                      )}

                      {video.status === "done" && !video.outputUrl && video.moderatedAt && (
                        <div className="mt-3 space-y-2 text-xs">
                          <p className="font-medium text-text">This video was removed by our team</p>
                          <p className="text-text-muted">
                            {video.moderationReason ?? "It broke our rules."} The file is gone and cannot be restored. Your credit is not refunded.
                          </p>
                          <Button type="button" variant="ghost-danger" size="sm" onClick={() => void remove(video)}>
                            Delete
                          </Button>
                        </div>
                      )}

                      {video.status === "failed" && (
                        <div className="mt-3 space-y-2 text-xs">
                          <p className="text-danger-foreground">
                            {video.error ?? "Something went wrong."} Your credit was not used.
                          </p>
                          <Button type="button" variant="ghost-danger" size="sm" onClick={() => void remove(video)}>
                            Delete
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </Card>
    </ModalOverlay>
  );
}
