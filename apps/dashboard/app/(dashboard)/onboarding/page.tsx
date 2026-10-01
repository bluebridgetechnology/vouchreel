"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Em } from "@/components/ui/em";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Space creation
  const [spaceName, setSpaceName] = useState("");
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [embedKey, setEmbedKey] = useState<string | null>(null);
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [spaceError, setSpaceError] = useState<string | null>(null);

  // Step 2: Add first testimonial
  const [videoUrl, setVideoUrl] = useState("");
  const [fetchingOembed, setFetchingOembed] = useState(false);
  const [oembedTitle, setOembedTitle] = useState("");
  const [oembedThumbnail, setOembedThumbnail] = useState<string | null>(null);
  const [oembedPlatform, setOembedPlatform] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [quote, setQuote] = useState("");
  const [addingTestimonial, setAddingTestimonial] = useState(false);
  const [testimonialError, setTestimonialError] = useState<string | null>(null);

  // Step 3: Embed snippet
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // Step 1 Submission
  async function handleCreateSpace(e?: React.FormEvent, fallbackName?: string) {
    if (e) e.preventDefault();
    const nameToUse = fallbackName || spaceName.trim() || "My First Space";

    setCreatingSpace(true);
    setSpaceError(null);

    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameToUse }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to create space");
      }

      setSpaceId(data.space.id);
      setEmbedKey(data.space.embedKey);
      setSpaceName(data.space.name);
      setStep(2);
    } catch (err) {
      setSpaceError(err instanceof Error ? err.message : "Failed to create space");
    } finally {
      setCreatingSpace(false);
    }
  }

  // Fetch oEmbed preview for step 2
  async function fetchPreview() {
    const trimmed = videoUrl.trim();
    if (!trimmed) return;

    setFetchingOembed(true);
    setTestimonialError(null);

    try {
      const res = await fetch(`/api/oembed?url=${encodeURIComponent(trimmed)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to fetch video preview");
      }

      setOembedTitle(data.title || "");
      setOembedThumbnail(data.thumbnailUrl || null);
      setOembedPlatform(data.platform || null);
    } catch (err) {
      setTestimonialError(err instanceof Error ? err.message : "Could not fetch preview");
    } finally {
      setFetchingOembed(false);
    }
  }

  // Step 2 Submission
  async function handleAddTestimonial(e: React.FormEvent) {
    e.preventDefault();
    if (!spaceId || !videoUrl.trim()) return;

    setAddingTestimonial(true);
    setTestimonialError(null);

    try {
      const res = await fetch(`/api/spaces/${spaceId}/testimonials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: videoUrl.trim(),
          title: oembedTitle.trim() || undefined,
          thumbnailUrl: oembedThumbnail || undefined,
          platform: oembedPlatform || undefined,
          customerName: customerName.trim() || undefined,
          quote: quote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to add testimonial");
      }

      setStep(3);
    } catch (err) {
      setTestimonialError(err instanceof Error ? err.message : "Failed to add testimonial");
    } finally {
      setAddingTestimonial(false);
    }
  }

  const widgetBaseUrl =
    process.env.NEXT_PUBLIC_WIDGET_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const embedSnippet = `<script async src="${widgetBaseUrl}/widget/${embedKey || "YOUR_EMBED_KEY"}.js"></script>`;

  function handleCopySnippet() {
    navigator.clipboard.writeText(embedSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2500);
  }

  function handleFinish() {
    if (spaceId) {
      router.push(`/spaces/${spaceId}/testimonials`);
    } else {
      router.push("/spaces");
    }
  }

  const steps = [
    { num: 1, label: "Create space" },
    { num: 2, label: "Add video" },
    { num: 3, label: "Install widget" },
  ];

  return (
    <div className="mx-auto max-w-2xl py-4 sm:py-8">
      <h1 className="sr-only">Set up your Vouchreel account</h1>

      {/* Stepper */}
      <ol className="mb-8 flex items-center">
        {steps.map((s, idx) => (
          <li key={s.num} className={cn("flex items-center", idx < 2 && "flex-1")}>
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-pill text-sm font-medium transition-colors",
                  step === s.num && "bg-brand text-text-on-accent",
                  step > s.num && "bg-success text-text-on-accent",
                  step < s.num && "bg-surface-sunken text-text-muted",
                )}
                aria-current={step === s.num ? "step" : undefined}
              >
                {step > s.num ? <Icon name="check-read" size="sm" /> : s.num}
              </span>
              <span
                className={cn(
                  "sr-only text-sm sm:not-sr-only",
                  step === s.num ? "font-medium text-text" : "text-text-muted",
                )}
              >
                {s.label}
              </span>
            </div>
            {idx < 2 && <div className={cn("mx-3 h-0.5 flex-1 rounded-pill sm:mx-4", step > s.num ? "bg-success" : "bg-surface-sunken")} />}
          </li>
        ))}
      </ol>

      {/* STEP 1: CREATE SPACE */}
      {step === 1 && (
        <Card padding="lg">
          <div className="space-y-2">
            <h2 className="text-3xl font-medium">
              Create your first <Em>space</Em>
            </h2>
            <p className="text-sm text-text-muted">
              A space holds the testimonials for a specific website, product, or domain.
            </p>
          </div>

          {spaceError && (
            <div role="alert" className="mt-5 rounded-control bg-danger-soft px-3.5 py-2.5 text-sm text-danger-foreground">
              {spaceError}
            </div>
          )}

          <form onSubmit={(e) => handleCreateSpace(e)} className="mt-6 space-y-5">
            <Field label="Website or space name" htmlFor="spaceName">
              <Input
                id="spaceName"
                type="text"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                placeholder="e.g. Acme SaaS, My Portfolio"
                required
                autoFocus
              />
            </Field>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleCreateSpace(undefined, "My First Space")}
                disabled={creatingSpace}
              >
                Skip for now
              </Button>
              <Button type="submit" size="lg" loading={creatingSpace} disabled={!spaceName.trim()}>
                Continue <Icon name="arrow-right" size="sm" />
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* STEP 2: ADD TESTIMONIAL */}
      {step === 2 && (
        <Card padding="lg">
          <div className="space-y-2">
            <h2 className="text-3xl font-medium">
              Add your first <Em>video</Em>
            </h2>
            <p className="text-sm text-text-muted">Paste a link from YouTube, Vimeo, or a direct MP4 file.</p>
          </div>

          {testimonialError && (
            <div role="alert" className="mt-5 rounded-control bg-danger-soft px-3.5 py-2.5 text-sm text-danger-foreground">
              {testimonialError}
            </div>
          )}

          <form onSubmit={handleAddTestimonial} className="mt-6 space-y-5">
            <Field label="Video URL" htmlFor="onboarding-video-url">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="onboarding-video-url"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  onBlur={fetchPreview}
                  placeholder="https://www.youtube.com/watch?v=…"
                  required
                  autoFocus
                  className="sm:flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={fetchPreview}
                  loading={fetchingOembed}
                  disabled={!videoUrl.trim()}
                >
                  Preview
                </Button>
              </div>
            </Field>

            {(oembedThumbnail || oembedTitle) && (
              <div className="flex items-center gap-3 rounded-card bg-surface-sunken p-3">
                {oembedThumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={oembedThumbnail} alt={oembedTitle} className="h-16 w-28 shrink-0 rounded-control object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{oembedTitle || "Video preview"}</p>
                  <p className="text-xs capitalize text-text-muted">Platform: {oembedPlatform || "video"}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Customer name (optional)" htmlFor="onboarding-customer-name">
                <Input
                  id="onboarding-customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                />
              </Field>
              <Field label="Key quote (optional)" htmlFor="onboarding-quote">
                <Input
                  id="onboarding-quote"
                  type="text"
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  placeholder="e.g. Highly recommend this!"
                />
              </Field>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setStep(3)}>
                Skip this step
              </Button>
              <Button type="submit" size="lg" loading={addingTestimonial} disabled={!videoUrl.trim()}>
                Save and continue <Icon name="arrow-right" size="sm" />
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* STEP 3: EMBED SNIPPET */}
      {step === 3 && (
        <Card padding="lg">
          <div className="space-y-2">
            <h2 className="text-3xl font-medium">
              Copy your embed <Em>script</Em>
            </h2>
            <p className="text-sm text-text-muted">
              Paste this single line of HTML anywhere on your website, for example before the closing &lt;/body&gt; tag.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <div className="rounded-card bg-surface-inverse p-4 text-text-inverse">
              <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
                {embedSnippet}
              </pre>
              <Button type="button" variant="outline-inverse" size="sm" className="mt-3" onClick={handleCopySnippet}>
                <Icon name={copiedSnippet ? "check-read" : "copy"} size="sm" />
                {copiedSnippet ? "Copied" : "Copy code"}
              </Button>
            </div>

            <div className="rounded-card bg-surface-sunken p-4 text-sm text-text-muted">
              Your unique embed key is{" "}
              <span className="break-all font-mono text-text">{embedKey}</span>. You can change widget positions,
              themes, and triggers anytime in your space settings.
            </div>

            <div className="flex justify-end pt-2">
              <Button type="button" size="lg" className="w-full sm:w-auto" onClick={handleFinish}>
                Finish and go to dashboard <Icon name="arrow-right" size="sm" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
