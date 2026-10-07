"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Icon } from "@/components/ui/icon";
import { textareaClass } from "@/components/ui/input";
import { ModalOverlay } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { toggleStyle } from "@/components/ui/toggle";
import { ScriptDiff } from "@/components/ai-video/script-diff";
import {
  STATUS_LABELS,
  isInFlight,
  pickActiveVideo,
  reviewScript,
  shouldPoll,
  summarizeCredits,
  type AiVideoView,
  type CreditsView,
} from "@/lib/ai-video/ui-state";
import { MAX_SCRIPT_WORDS, countWords } from "@/lib/ai-video/trim";
import { notify } from "@/lib/notify";
import { WidgetVideoSwitch } from "@/components/review-video/widget-switch";
import { cn } from "@/lib/utils";

interface Options {
  templates: { id: string; label: string; background: string; text: string }[];
  voices: { id: string; label: string }[];
  aspects: ("9:16" | "16:9")[];
}

interface Loaded {
  videos: AiVideoView[];
  consent: boolean;
  narrationAvailable: boolean;
  credits: CreditsView;
  options: Options;
}

interface Props {
  spaceId: string;
  testimonial: { id: string; customerName: string | null; quote: string | null };
  onClose: () => void;
}

const STATUS_BADGE = {
  draft: "warning",
  queued: "info",
  rendering: "info",
  done: "success",
  failed: "danger",
} as const;

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? fallback;
}

export function AiVideoModal({ spaceId, testimonial, onClose }: Props) {
  const confirm = useConfirm();
  const base = `/api/spaces/${spaceId}`;
  const listUrl = `${base}/testimonials/${testimonial.id}/ai-video`;

  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [template, setTemplate] = useState("bold");
  const [voice, setVoice] = useState("warm");
  const [aspect, setAspect] = useState<"9:16" | "16:9">("9:16");
  const [script, setScript] = useState("");
  const [creating, setCreating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    async (initial = false) => {
      try {
        const res = await fetch(listUrl);
        if (!res.ok) throw new Error(await readError(res, "Could not load AI videos."));
        const next = (await res.json()) as Loaded;
        setData(next);
        setLoadError(null);
        if (initial) {
          setActiveId(pickActiveVideo(next.videos));
          setTemplate(next.options.templates[0]?.id ?? "bold");
          setVoice(next.options.voices[0]?.id ?? "warm");
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Could not load AI videos.");
      }
    },
    [listUrl],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  // Check on a video that is being created, every few seconds, only while the dialog is open
  const polling = data ? shouldPoll(data.videos) : false;
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [polling, load]);

  const active = data?.videos.find((v) => v.id === activeId) ?? null;

  // Start the editor from the suggested trim whenever a different draft is opened
  useEffect(() => {
    if (active?.status === "draft") setScript(active.scriptTrimmed ?? active.scriptOriginal);
    setActionError(null);
    // Deliberately keyed on the opened video's id only: polling refreshes `active` and must not reset edits
  }, [active?.id]);

  async function createDraft() {
    setCreating(true);
    setActionError(null);
    try {
      const res = await fetch(listUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template, voice, aspect }),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not start the video."));
      const { video } = (await res.json()) as { video: AiVideoView };
      await load();
      setActiveId(video.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not start the video.");
    } finally {
      setCreating(false);
    }
  }

  async function approve() {
    if (!active) return;
    setApproving(true);
    setActionError(null);
    try {
      const res = await fetch(`${base}/ai-videos/${active.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", script }),
      });
      if (!res.ok) throw new Error(await readError(res, "Could not approve the script."));
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not approve the script.");
    } finally {
      setApproving(false);
    }
  }

  async function remove(video: AiVideoView) {
    const ok = await confirm({
      title: video.status === "draft" ? "Discard this draft?" : "Delete this video?",
      description:
        video.status === "done"
          ? "The video will be removed. The credit you used is not refunded."
          : "Nothing has been created or charged.",
      confirmLabel: video.status === "draft" ? "Discard" : "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`${base}/ai-videos/${video.id}`, { method: "DELETE" });
    if (!res.ok) {
      notify.error(await readError(res, "Could not delete the video."));
      return;
    }
    if (activeId === video.id) setActiveId(null);
    await load();
  }

  async function withdrawConsentForCustomer() {
    const ok = await confirm({
      title: "Record that the customer withdrew consent?",
      description:
        "Every AI video made from this testimonial is removed and none can be made again without a new agreement. This cannot be undone.",
      confirmLabel: "Withdraw consent",
      tone: "danger",
    });
    if (!ok) return;
    const res = await fetch(`${listUrl}/consent`, { method: "DELETE" });
    if (!res.ok) {
      notify.error(await readError(res, "Could not record the withdrawal."));
      return;
    }
    setActiveId(null);
    notify.success("Consent withdrawn. Their videos were removed.");
    await load();
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      notify.success("Link copied.");
    } catch {
      notify.error("Could not copy the link.");
    }
  }

  const credits = data ? summarizeCredits(data.credits) : null;
  const review = active?.status === "draft" ? reviewScript(active.scriptOriginal, script) : null;
  const originalWords = active ? countWords(active.scriptOriginal) : 0;

  return (
    <ModalOverlay label="AI video" onClose={onClose}>
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-card border bg-surface shadow-float">
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-control bg-brand-soft text-brand">
                <Icon name="magic-stick-3" size="sm" />
              </span>
              <h3 className="text-lg font-medium text-text">AI video</h3>
            </div>
            <p className="mt-0.5 text-xs text-text-muted">
              Turn {testimonial.customerName ? `${testimonial.customerName}'s` : "this"} written testimonial into a short narrated video.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <Icon name="close" size="sm" />
          </Button>
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
            <div className="flex items-center justify-center py-12">
              <Spinner label="Loading" />
            </div>
          )}

          {data && credits && (
            <>
              {actionError && (
                <p role="alert" className="rounded-card bg-danger-soft p-3.5 text-xs text-danger-foreground">
                  {actionError}
                </p>
              )}

              {/* ---------- Create ---------- */}
              {!active && (
                <section className="space-y-5" aria-label="Create a video">
                  {!data.consent ? (
                    <Notice icon="shield-check" title="This customer hasn't agreed to AI video">
                      Videos can only be made from testimonials where the customer ticked the AI video box when they wrote it
                      through your collection form. We never create a video without that agreement.
                    </Notice>
                  ) : !data.narrationAvailable ? (
                    <Notice icon="info-circle" title="AI video isn't available right now">
                      Voice narration isn't set up on this server yet. Please contact support.
                    </Notice>
                  ) : credits.blocked ? (
                    <Notice icon="info-circle" title={credits.text}>
                      <Link href="/pricing" className={buttonVariants({ variant: "link", size: "bare" })}>
                        See plans
                      </Link>
                    </Notice>
                  ) : (
                    <>
                      <fieldset className="space-y-2">
                        <legend className="text-xs font-medium text-text">Style</legend>
                        <div role="radiogroup" aria-label="Style" className="grid grid-cols-3 gap-2">
                          {data.options.templates.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              role="radio"
                              aria-checked={template === t.id}
                              onClick={() => setTemplate(t.id)}
                              className={cn("rounded-card border p-2 text-left transition-all", toggleStyle("choice", template === t.id))}
                            >
                              <span
                                className="flex h-14 items-center justify-center rounded-control text-lg font-medium"
                                style={{ background: `#${t.background}`, color: `#${t.text}` }}
                                aria-hidden
                              >
                                Aa
                              </span>
                              <span className="mt-1.5 block text-xs font-medium">{t.label}</span>
                            </button>
                          ))}
                        </div>
                      </fieldset>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <fieldset className="space-y-2">
                          <legend className="text-xs font-medium text-text">Voice</legend>
                          <div role="radiogroup" aria-label="Voice" className="grid gap-2">
                            {data.options.voices.map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                role="radio"
                                aria-checked={voice === v.id}
                                onClick={() => setVoice(v.id)}
                                className={cn("rounded-control border px-3 py-2 text-left text-xs font-medium", toggleStyle("choice", voice === v.id))}
                              >
                                {v.label}
                              </button>
                            ))}
                          </div>
                        </fieldset>
                        <fieldset className="space-y-2">
                          <legend className="text-xs font-medium text-text">Shape</legend>
                          <div role="radiogroup" aria-label="Shape" className="grid gap-2">
                            {data.options.aspects.map((a) => (
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
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                        <p className="text-xs text-text-muted">{credits.text}. You review the script before anything is used.</p>
                        <Button type="button" onClick={createDraft} loading={creating}>
                          Review script
                        </Button>
                      </div>
                    </>
                  )}
                </section>
              )}

              {/* ---------- Review the script ---------- */}
              {active?.status === "draft" && review && (
                <section className="space-y-4" aria-label="Review the script">
                  <div className="space-y-1">
                    <label htmlFor="ai-video-script" className="text-xs font-medium text-text">
                      What the video will say
                    </label>
                    <textarea
                      id="ai-video-script"
                      value={script}
                      onChange={(e) => setScript(e.target.value)}
                      rows={5}
                      aria-describedby="ai-video-script-help"
                      aria-invalid={!review.check.ok}
                      className={cn(textareaClass, "text-sm")}
                    />
                    <div id="ai-video-script-help" className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className={review.check.ok ? "text-text-muted" : "text-danger-foreground"} role={review.check.ok ? undefined : "alert"}>
                        {review.check.ok
                          ? "You can only remove words. The customer's words are never added to or changed."
                          : review.check.reason}
                      </span>
                      <span className={cn("tabular-nums", review.words > MAX_SCRIPT_WORDS ? "text-danger-foreground" : "text-text-muted")}>
                        {review.words} / {MAX_SCRIPT_WORDS} words
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 rounded-card border bg-surface-sunken/40 p-4">
                    <p className="text-xs font-medium text-text">
                      {review.trimmed
                        ? `${review.removedWords} word${review.removedWords === 1 ? "" : "s"} left out of the customer's testimonial`
                        : "The full testimonial is used"}
                    </p>
                    <ScriptDiff tokens={review.diff} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setScript(active.scriptTrimmed ?? active.scriptOriginal)}>
                      Reset to suggestion
                    </Button>
                    {originalWords <= MAX_SCRIPT_WORDS && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setScript(active.scriptOriginal)}>
                        Use the full text
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => void remove(active)}>
                        Discard
                      </Button>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-text-muted">Uses 1 credit. {credits.text}.</p>
                      <Button type="button" onClick={approve} loading={approving} disabled={!review.check.ok || credits.blocked}>
                        Create video
                      </Button>
                    </div>
                  </div>
                </section>
              )}

              {/* ---------- Creating ---------- */}
              {active && isInFlight(active.status) && (
                <section className="flex flex-col items-center gap-3 py-10 text-center" aria-live="polite">
                  <Spinner className="size-8" label="Creating your video" />
                  <p className="text-sm font-medium text-text">
                    {active.status === "queued" ? "Waiting for a free slot…" : "Creating your video…"}
                  </p>
                  <p className="max-w-sm text-xs text-text-muted">
                    This usually takes under a minute. You can close this window; we'll notify you when it's ready.
                  </p>
                </section>
              )}

              {/* ---------- Ready ---------- */}
              {active?.status === "done" && active.outputUrl && (
                <section className="space-y-4" aria-label="Your video">
                  <video
                    controls
                    playsInline
                    src={active.outputUrl}
                    className={cn("mx-auto rounded-card bg-scrim", active.aspect === "9:16" ? "max-h-[55vh] w-auto" : "w-full")}
                  />
                  <p className="text-center text-xs text-text-muted">
                    Labelled "AI-generated from a written review" in the video, so viewers always know.
                  </p>
                  <WidgetVideoSwitch endpoint={`${base}/ai-videos/${active.id}/widget`} checked={Boolean(active.showInWidget)} isAi onChanged={load} />
                  <div className="flex flex-wrap justify-center gap-2">
                    <a href={active.outputUrl} download className={buttonVariants({ variant: "primary", size: "sm" })}>
                      Download
                    </a>
                    <Button type="button" variant="outline" size="sm" onClick={() => void copyLink(active.outputUrl!)}>
                      <Icon name="copy" size="sm" />
                      Copy link
                    </Button>
                    <Button type="button" variant="ghost-danger" size="sm" onClick={() => void remove(active)}>
                      Delete
                    </Button>
                  </div>
                </section>
              )}

              {/* ---------- Taken down by our team ---------- */}
              {active?.status === "done" && !active.outputUrl && active.moderatedAt && (
                <Notice icon="danger-triangle" title="This video was removed by our team">
                  {active.moderationReason ?? "It broke our rules."} The file is gone and cannot be restored. Your credit is not refunded.
                  <span className="mt-3 flex gap-2">
                    <Button type="button" variant="ghost-danger" size="sm" onClick={() => void remove(active)}>
                      Delete
                    </Button>
                  </span>
                </Notice>
              )}

              {/* ---------- Failed ---------- */}
              {active?.status === "failed" && (
                <Notice icon="danger-triangle" title="This video could not be created">
                  {active.error ?? "Something went wrong."} Your credit was not used.
                  <span className="mt-3 flex gap-2">
                    <Button type="button" size="sm" onClick={() => setActiveId(null)}>
                      Try again
                    </Button>
                    <Button type="button" variant="ghost-danger" size="sm" onClick={() => void remove(active)}>
                      Delete
                    </Button>
                  </span>
                </Notice>
              )}

              {/* ---------- History ---------- */}
              {data.videos.length > 0 && (
                <section aria-label="Your AI videos" className="space-y-2 border-t pt-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-medium text-text">Videos from this testimonial</h4>
                    {active && (
                      <Button type="button" variant="link" size="bare" className="text-xs" onClick={() => setActiveId(null)}>
                        New video
                      </Button>
                    )}
                  </div>
                  <ul className="divide-y rounded-card border">
                    {data.videos.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => setActiveId(v.id)}
                          aria-current={v.id === activeId}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "bare" }),
                            "w-full justify-between gap-3 rounded-none px-3 py-2.5 text-left text-xs",
                            v.id === activeId && "bg-brand-soft/50",
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-text">
                              {(data.options.templates.find((t) => t.id === v.template)?.label ?? v.template)} · {v.aspect}
                            </span>
                            <span className="block text-text-muted">{new Date(v.createdAt).toLocaleString()}</span>
                          </span>
                          {v.moderatedAt ? <Badge variant="neutral">Removed</Badge> : <Badge variant={STATUS_BADGE[v.status]}>{STATUS_LABELS[v.status]}</Badge>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {data.consent && (
                <p className="border-t pt-4 text-xs text-text-muted">
                  The customer agreed to AI video. Their confirmation email has a link to withdraw. If they told you directly instead,{" "}
                  <button type="button" onClick={() => void withdrawConsentForCustomer()} className={buttonVariants({ variant: "link", size: "bare" })}>
                    record that they withdrew consent
                  </button>
                  .
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

function Notice({ icon, title, children }: { icon: "info-circle" | "shield-check" | "danger-triangle"; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-card border bg-surface-sunken/40 p-4">
      <Icon name={icon} className="mt-0.5 text-text-muted" />
      <div className="space-y-1 text-xs text-text-muted">
        <p className="text-sm font-medium text-text">{title}</p>
        <div>{children}</div>
      </div>
    </div>
  );
}
