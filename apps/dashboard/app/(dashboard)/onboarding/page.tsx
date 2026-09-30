"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="sr-only">Set up your Vouchreel account</h1>
      {/* Stepper Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: "Create Space" },
            { num: 2, label: "Add Video" },
            { num: 3, label: "Install Widget" },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    step === s.num
                      ? "bg-primary text-primary-foreground"
                      : step > s.num
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s.num ? "✓" : s.num}
                </div>
                <span
                  className={`sr-only text-xs font-semibold sm:not-sr-only ${
                    step === s.num ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < 2 && (
                <div
                  className={`mx-4 h-0.5 w-12 sm:w-20 ${
                    step > s.num ? "bg-emerald-500" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: CREATE SPACE */}
      {step === 1 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Step 1: Create your first space
            </h2>
            <p className="text-xs text-muted-foreground">
              A space holds the testimonials for a specific website, product, or domain.
            </p>
          </div>

          {spaceError && (
            <div className="mt-4 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              {spaceError}
            </div>
          )}

          <form onSubmit={(e) => handleCreateSpace(e)} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label htmlFor="spaceName" className="text-xs font-semibold text-foreground">
                Website or Space Name
              </label>
              <input
                id="spaceName"
                type="text"
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                placeholder="e.g. Acme SaaS, My Portfolio"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                required
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => handleCreateSpace(undefined, "My First Space")}
                disabled={creatingSpace}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </button>
              <button
                type="submit"
                disabled={creatingSpace || !spaceName.trim()}
                className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
              >
                {creatingSpace ? "Creating..." : "Continue to Step 2 →"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2: ADD TESTIMONIAL */}
      {step === 2 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Step 2: Add your first video testimonial
            </h2>
            <p className="text-xs text-muted-foreground">
              Paste a link from YouTube, Vimeo, or a direct MP4 file.
            </p>
          </div>

          {testimonialError && (
            <div className="mt-4 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              {testimonialError}
            </div>
          )}

          <form onSubmit={handleAddTestimonial} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="onboarding-video-url"
                className="text-xs font-semibold text-foreground"
              >
                Video URL
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="onboarding-video-url"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  onBlur={fetchPreview}
                  placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
                  className="flex-1 rounded-md border bg-background px-3 py-2 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                  autoFocus
                />
                <button
                  type="button"
                  onClick={fetchPreview}
                  disabled={fetchingOembed || !videoUrl.trim()}
                  className="rounded-md border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                >
                  {fetchingOembed ? "Loading..." : "Preview"}
                </button>
              </div>
            </div>

            {/* Preview Card */}
            {(oembedThumbnail || oembedTitle) && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                {oembedThumbnail && (
                  <img
                    src={oembedThumbnail}
                    alt={oembedTitle}
                    className="h-16 w-28 rounded object-cover"
                  />
                )}
                <div className="flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    {oembedTitle || "Video Preview"}
                  </p>
                  <p className="text-[11px] text-muted-foreground capitalize">
                    Platform: {oembedPlatform || "video"}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="onboarding-customer-name"
                  className="text-xs font-semibold text-foreground"
                >
                  Customer Name (Optional)
                </label>
                <input
                  id="onboarding-customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Jane Smith"
                  className="w-full rounded-md border bg-background px-3 py-2 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="onboarding-quote"
                  className="text-xs font-semibold text-foreground"
                >
                  Key Soundbite / Quote (Optional)
                </label>
                <input
                  id="onboarding-quote"
                  type="text"
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                  placeholder="e.g. Highly recommend this product!"
                  className="w-full rounded-md border bg-background px-3 py-2 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Skip this step
              </button>
              <button
                type="submit"
                disabled={addingTestimonial || !videoUrl.trim()}
                className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
              >
                {addingTestimonial ? "Saving..." : "Save & Continue →"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 3: EMBED SNIPPET */}
      {step === 3 && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Step 3: Copy your embed script
            </h2>
            <p className="text-xs text-muted-foreground">
              Paste this single line of HTML anywhere on your website (e.g. before the closing &lt;/body&gt; tag).
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <div className="relative rounded-lg border bg-zinc-950 p-4 font-mono text-xs text-zinc-100 dark:bg-zinc-900">
              <pre className="overflow-x-auto whitespace-pre-wrap break-all">
                {embedSnippet}
              </pre>
              <button
                type="button"
                onClick={handleCopySnippet}
                className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 transition-colors hover:bg-zinc-700"
              >
                {copiedSnippet ? (
                  <span className="text-emerald-400">✓ Copied!</span>
                ) : (
                  <span>Copy Code</span>
                )}
              </button>
            </div>

            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              💡 Your unique embed key is:{" "}
              <span className="font-mono font-semibold text-foreground">
                {embedKey}
              </span>
              . You can change widget positions, themes, and triggers anytime in your space settings.
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={handleFinish}
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90"
              >
                Finish & Go to Dashboard →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
