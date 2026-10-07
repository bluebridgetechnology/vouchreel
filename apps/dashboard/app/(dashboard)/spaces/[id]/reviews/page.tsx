"use client";

import { use, useEffect, useState } from "react";
import { ReviewVideoModal } from "@/components/review-video/review-video-modal";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { inputClass, textareaClass } from "@/components/ui/input";
import { toggleStyle } from "@/components/ui/toggle";
import { ModalOverlay } from "@/components/ui/modal";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm";

interface ReviewSource {
  id: string;
  provider: "google" | "trustpilot";
  providerBusinessId: string;
  lastSyncAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface ReviewItem {
  id: string;
  spaceId: string;
  sourceId: string | null;
  provider: "google" | "trustpilot" | "own";
  authorName: string;
  authorPhotoUrl: string | null;
  rating: number | null;
  text: string | null;
  linkUrl: string | null;
  reviewDate: string | null;
  providerReviewId: string;
  isApproved: boolean;
  createdAt: string;
}

interface ReviewsPageProps {
  params: Promise<{ id: string }>;
}

export default function SpaceReviewsPage({ params }: ReviewsPageProps) {
  const confirm = useConfirm();
  const { id: spaceId } = use(params);

  const [loading, setLoading] = useState(true);
  const [videoOpen, setVideoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<ReviewSource[]>([]);
  const [reviewsList, setReviewsList] = useState<ReviewItem[]>([]);

  // Filter state
  const [filter, setFilter] = useState<"all" | "approved" | "hidden">("all");
  const [search, setSearch] = useState("");

  // Modal / Form state for connecting a provider
  const [connectModalProvider, setConnectModalProvider] = useState<
    "google" | "trustpilot" | null
  >(null);
  const [providerBusinessId, setProviderBusinessId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Reviews the owner types in themselves: null = closed, "new" = adding, an id = editing that review
  const [ownEditing, setOwnEditing] = useState<string | "new" | null>(null);
  const [ownName, setOwnName] = useState("");
  const [ownText, setOwnText] = useState("");
  const [ownLink, setOwnLink] = useState("");
  const [ownSaving, setOwnSaving] = useState(false);
  const [ownError, setOwnError] = useState<string | null>(null);

  function openOwnForm(review?: ReviewItem) {
    setOwnEditing(review ? review.id : "new");
    setOwnName(review?.authorName ?? "");
    setOwnText(review?.text ?? "");
    setOwnLink(review?.linkUrl ?? "");
    setOwnError(null);
  }

  async function handleSaveOwn(e: React.FormEvent) {
    e.preventDefault();
    if (!ownEditing) return;
    try {
      setOwnSaving(true);
      setOwnError(null);
      const editing = ownEditing !== "new";
      const res = await fetch(`/api/spaces/${spaceId}/reviews/own${editing ? `/${ownEditing}` : ""}`, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ownName, text: ownText, link: ownLink.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        const fields = data.error?.details as Record<string, string[]> | undefined;
        throw new Error(fields ? Object.values(fields).flat()[0] : data.error?.message || "Could not save the review");
      }
      setOwnEditing(null);
      notify.success(editing ? "Review updated" : "Review added");
      await loadData();
    } catch (err) {
      setOwnError(err instanceof Error ? err.message : "Could not save the review");
    } finally {
      setOwnSaving(false);
    }
  }

  // Syncing state
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/spaces/${spaceId}/reviews`);
      if (!res.ok) {
        throw new Error("Failed to load reviews data");
      }
      const data = await res.json();
      setSources(data.sources || []);
      setReviewsList(data.reviews || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading reviews");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [spaceId]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!connectModalProvider || !providerBusinessId.trim()) return;

    try {
      setConnecting(true);
      setConnectError(null);

      const res = await fetch(`/api/spaces/${spaceId}/reviews/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: connectModalProvider,
          providerBusinessId: providerBusinessId.trim(),
          apiKey: apiKey.trim() || undefined,
          syncNow: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to connect review source");
      }

      setConnectModalProvider(null);
      setProviderBusinessId("");
      setApiKey("");

      if (data.syncError) {
        setSyncMessage(`Connected, but initial sync had a notice: ${data.syncError}`);
      } else {
        setSyncMessage("Successfully connected and synced reviews!");
      }
      setTimeout(() => setSyncMessage(null), 5000);

      await loadData();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function handleSyncSource(sourceId: string) {
    try {
      setSyncingSourceId(sourceId);
      setSyncMessage(null);

      const res = await fetch(
        `/api/spaces/${spaceId}/reviews/sources/${sourceId}/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: true }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Sync failed");
      }

      setSyncMessage(
        `Synced successfully! Fetched ${data.syncResult.totalFetched} review(s) (${data.syncResult.importedCount} new, ${data.syncResult.updatedCount} updated).`
      );
      setTimeout(() => setSyncMessage(null), 5000);

      await loadData();
    } catch (err) {
      notify.fromError(err, "Sync failed");
    } finally {
      setSyncingSourceId(null);
    }
  }

  async function handleDisconnectSource(sourceId: string) {
    if (
      !(await confirm({ title: "Disconnect this source?", description: "All reviews imported from it will also be deleted.", confirmLabel: "Disconnect", tone: "danger" }))
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/spaces/${spaceId}/reviews/sources/${sourceId}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        throw new Error("Failed to disconnect source");
      }
      await loadData();
    } catch (err) {
      notify.fromError(err, "Failed to disconnect source");
    }
  }

  async function handleToggleApprove(review: ReviewItem) {
    try {
      const newStatus = !review.isApproved;
      // Optimistic update
      setReviewsList((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, isApproved: newStatus } : r))
      );

      const res = await fetch(`/api/spaces/${spaceId}/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isApproved: newStatus }),
      });

      if (!res.ok) {
        // Rollback
        setReviewsList((prev) =>
          prev.map((r) =>
            r.id === review.id ? { ...r, isApproved: review.isApproved } : r
          )
        );
        throw new Error("Failed to update status");
      }
    } catch (err) {
      notify.fromError(err, "Failed to update review status");
    }
  }

  async function handleDeleteReview(reviewId: string) {
    if (!(await confirm({ title: "Delete this review?", description: "It will be permanently removed from your space.", confirmLabel: "Delete review", tone: "danger" }))) {
      return;
    }

    try {
      setReviewsList((prev) => prev.filter((r) => r.id !== reviewId));

      const res = await fetch(`/api/spaces/${spaceId}/reviews/${reviewId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        await loadData();
        throw new Error("Failed to delete review");
      }
    } catch (err) {
      notify.fromError(err, "Failed to delete review");
    }
  }

  const filteredReviews = reviewsList.filter((r) => {
    if (filter === "approved" && !r.isApproved) return false;
    if (filter === "hidden" && r.isApproved) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchAuthor = r.authorName.toLowerCase().includes(q);
      const matchText = r.text?.toLowerCase().includes(q);
      if (!matchAuthor && !matchText) return false;
    }
    return true;
  });

  const googleSource = sources.find((s) => s.provider === "google");
  const trustpilotSource = sources.find((s) => s.provider === "trustpilot");

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-6">
        <div>
          <h2 className="text-2xl font-medium tracking-tight text-text">
            External Reviews
          </h2>
          <p className="text-sm text-text-muted">
            Connect your Google Business and Trustpilot profiles to import verified text
            reviews and showcase them alongside video testimonials.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openOwnForm()} className={buttonVariants({ variant: "outline", size: "md" })}>
            Add your own review
          </button>
          <button type="button" onClick={() => setVideoOpen(true)} className={buttonVariants({ variant: "primary", size: "md" })}>
            Create review video
          </button>
        </div>
      </div>

      {ownEditing && (
        <ModalOverlay label="Add your own review" onClose={() => setOwnEditing(null)}>
          <form onSubmit={handleSaveOwn} className="w-full max-w-md space-y-4 rounded-card border bg-surface p-4 shadow-float sm:p-6">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-medium text-text">{ownEditing === "new" ? "Add your own review" : "Edit review"}</h3>
              <button type="button" onClick={() => setOwnEditing(null)} className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-sm")} aria-label="Close">
                ✕
              </button>
            </div>
            <p className="text-xs text-text-muted">
              For reviews that live on your own site or came to you directly. Use them only if they are genuine, and add them exactly as written.
              No rating or logo is shown with them.
            </p>
            {ownError && <div role="alert" className="rounded-card border border-danger/30 bg-danger-soft p-3 text-xs text-danger-foreground">{ownError}</div>}
            <label className="block space-y-1.5 text-xs font-medium text-text">
              Name
              <input value={ownName} onChange={(e) => setOwnName(e.target.value)} maxLength={80} required className={inputClass} />
            </label>
            <label className="block space-y-1.5 text-xs font-medium text-text">
              Review
              <textarea value={ownText} onChange={(e) => setOwnText(e.target.value)} maxLength={1000} required rows={5} className={textareaClass} />
            </label>
            <label className="block space-y-1.5 text-xs font-medium text-text">
              Link to the review (optional)
              <input value={ownLink} onChange={(e) => setOwnLink(e.target.value)} type="url" placeholder="https://yoursite.com/reviews" className={inputClass} />
              <span className="block font-normal text-text-muted">Only the site name (for example yoursite.com) is shown in videos.</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOwnEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={ownSaving}>
                {ownSaving ? "Saving..." : "Save review"}
              </Button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {videoOpen && <ReviewVideoModal spaceId={spaceId} onClose={() => setVideoOpen(false)} />}

      {syncMessage && (
        <div className="rounded-card border border-success/30 bg-success-soft p-3.5 text-sm text-success-foreground flex items-center justify-between">
          <span>{syncMessage}</span>
          <button
            onClick={() => setSyncMessage(null)}
            className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "ml-2 text-xs")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Connected Sources Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Google Reviews Card */}
        <div className="rounded-card border bg-surface p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-control bg-info-soft text-info-foreground font-medium border border-info/30">
                <svg className="h-6 w-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.665-5.17 3.665-9.12z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.13C3.26 21.4 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.57H1.24C.45 8.14 0 9.9 0 12s.45 3.86 1.24 5.43l4.04-3.14z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.6 1.24 6.57l4.04 3.14c.95-2.83 3.6-4.96 6.72-4.96z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-text text-sm">Google Reviews</h3>
                <p className="text-xs text-text-muted">Google Places API</p>
              </div>
            </div>

            {googleSource ? (
              <span className="inline-flex items-center gap-1 rounded-pill bg-success-soft px-2 py-0.5 text-xs font-medium text-success-foreground">
                <span className="h-1.5 w-1.5 rounded-pill bg-success" />
                Connected
              </span>
            ) : (
              <span className="rounded-pill bg-surface-sunken px-2 py-0.5 text-xs font-medium text-text-muted">
                Not Connected
              </span>
            )}
          </div>

          <div className="rounded-card bg-surface-sunken/40 p-3 text-xs text-text-muted space-y-1">
            <p>
              <strong>Note:</strong> The official Google Places API caps review retrieval
              to the ~5 most helpful/recent reviews for your place listing.
            </p>
            {googleSource && (
              <p className="font-mono text-2xs truncate">
                Place ID: {googleSource.providerBusinessId}
              </p>
            )}
            {googleSource?.lastSyncAt && (
              <p className="text-2xs">
                Last synced: {new Date(googleSource.lastSyncAt).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            {googleSource ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSyncSource(googleSource.id)}
                  disabled={syncingSourceId === googleSource.id}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {syncingSourceId === googleSource.id ? (
                    <span className="h-3 w-3 animate-spin rounded-pill border-2 border-text border-t-transparent" />
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  Sync Now
                </button>
                <button
                  type="button"
                  onClick={() => handleDisconnectSource(googleSource.id)}
                  className={buttonVariants({ variant: "outline-danger", size: "sm" })}
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setConnectModalProvider("google");
                  setProviderBusinessId("");
                  setApiKey("");
                  setConnectError(null);
                }}
                className={buttonVariants({ variant: "primary", size: "sm" })}
              >
                Connect Google Business
              </button>
            )}
          </div>
        </div>

        {/* Trustpilot Reviews Card */}
        <div className="rounded-card border bg-surface p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-control bg-success-soft text-success-foreground font-medium border border-success/30">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                  <path fill="#00b67a" d="M12 2l2.9 8.9h9.3l-7.5 5.5 2.9 8.9L12 19.8l-7.6 5.5 2.9-8.9L-.2 10.9h9.3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-text text-sm">Trustpilot Reviews</h3>
                <p className="text-xs text-text-muted">Trustpilot Business API</p>
              </div>
            </div>

            {trustpilotSource ? (
              <span className="inline-flex items-center gap-1 rounded-pill bg-success-soft px-2 py-0.5 text-xs font-medium text-success-foreground">
                <span className="h-1.5 w-1.5 rounded-pill bg-success" />
                Connected
              </span>
            ) : (
              <span className="rounded-pill bg-surface-sunken px-2 py-0.5 text-xs font-medium text-text-muted">
                Not Connected
              </span>
            )}
          </div>

          <div className="rounded-card bg-surface-sunken/40 p-3 text-xs text-text-muted space-y-1">
            <p>
              Import genuine customer reviews directly from your Trustpilot business unit
              with star ratings and verified review text.
            </p>
            {trustpilotSource && (
              <p className="font-mono text-2xs truncate">
                Business Unit: {trustpilotSource.providerBusinessId}
              </p>
            )}
            {trustpilotSource?.lastSyncAt && (
              <p className="text-2xs">
                Last synced: {new Date(trustpilotSource.lastSyncAt).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            {trustpilotSource ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSyncSource(trustpilotSource.id)}
                  disabled={syncingSourceId === trustpilotSource.id}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {syncingSourceId === trustpilotSource.id ? (
                    <span className="h-3 w-3 animate-spin rounded-pill border-2 border-text border-t-transparent" />
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  Sync Now
                </button>
                <button
                  type="button"
                  onClick={() => handleDisconnectSource(trustpilotSource.id)}
                  className={buttonVariants({ variant: "outline-danger", size: "sm" })}
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setConnectModalProvider("trustpilot");
                  setProviderBusinessId("");
                  setApiKey("");
                  setConnectError(null);
                }}
                className={buttonVariants({ variant: "primary", size: "sm" })}
              >
                Connect Trustpilot Business
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Connect Modal */}
      {connectModalProvider && (
        <ModalOverlay label="Connect review source" onClose={() => setConnectModalProvider(null)}>
          <div className="w-full max-w-md rounded-card border bg-surface p-4 sm:p-6 shadow-float space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-medium text-text">
                Connect {connectModalProvider === "google" ? "Google Business" : "Trustpilot"}
              </h3>
              <button
                onClick={() => setConnectModalProvider(null)}
                className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-sm")}
              >
                ✕
              </button>
            </div>

            {connectError && (
              <div className="rounded-card border border-danger/30 bg-danger-soft p-3 text-xs text-danger-foreground">
                {connectError}
              </div>
            )}

            <form onSubmit={handleConnect} className="space-y-4 text-xs">
              {connectModalProvider === "google" ? (
                <>
                  <div className="space-y-1.5">
                    <label className="font-medium text-text">
                      Google Place ID <span className="text-danger-foreground">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ChIJN1t_tDeuEmsRUsoyG83frY4"
                      value={providerBusinessId}
                      onChange={(e) => setProviderBusinessId(e.target.value)}
                      className={cn(inputClass, "w-full text-xs font-mono")}
                    />
                    <p className="text-2xs text-text-muted">
                      You can look up your Place ID using the official Google Place ID Finder.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-medium text-text">
                      Google Places API Key (Optional)
                    </label>
                    <input
                      type="password"
                      placeholder="AIzaSy... (uses server key if left blank)"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className={cn(inputClass, "w-full text-xs font-mono")}
                    />
                    <p className="text-2xs text-text-muted">
                      Stored securely encrypted using AES-256-GCM.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="font-medium text-text">
                      Trustpilot Business Unit ID or Domain{" "}
                      <span className="text-danger-foreground">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 46a627cd000064000500e056 or yourbrand.com"
                      value={providerBusinessId}
                      onChange={(e) => setProviderBusinessId(e.target.value)}
                      className={cn(inputClass, "w-full text-xs font-mono")}
                    />
                    <p className="text-2xs text-text-muted">
                      Enter your Trustpilot business unit ID or registered domain.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-medium text-text">
                      Trustpilot API Key (Optional)
                    </label>
                    <input
                      type="password"
                      placeholder="Enter Trustpilot API key (if required)"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className={cn(inputClass, "w-full text-xs font-mono")}
                    />
                    <p className="text-2xs text-text-muted">
                      Stored securely encrypted using AES-256-GCM.
                    </p>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setConnectModalProvider(null)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={connecting}
                  size="sm" loading={connecting}
                >
                  {connecting ? "Connecting & Syncing..." : "Connect Source"}
                </Button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Reviews List Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-medium text-text">Reviews</h3>
            <span className="rounded-pill bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-text-muted">
              {reviewsList.length}
            </span>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search author or review..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(inputClass, "text-xs")}
            />
            <div className="flex rounded-control border bg-surface-sunken/40 p-0.5 text-xs">
              {(["all", "approved", "hidden"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={cn("rounded-control px-2.5 py-1 capitalize font-medium transition-all", toggleStyle("raised", filter === t))}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-card border bg-surface-sunken/30" />
            ))}
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="rounded-card border border-dashed p-10 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-pill bg-surface-sunken text-text-muted">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h4 className="font-medium text-text text-sm">No reviews found</h4>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              {reviewsList.length === 0
                ? "Connect your Google Places or Trustpilot business profile above to import customer reviews, or add your own."
                : "No reviews match your search or filter."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredReviews.map((review) => (
              <div
                key={review.id}
                className={`flex flex-col justify-between rounded-card border bg-surface p-4 shadow-xs transition-all ${
                  review.isApproved ? "border-border" : "border-border/40 opacity-70 bg-surface-sunken/20"
                }`}
              >
                <div className="space-y-3">
                  {/* Top Bar: Provider badge & Approval status */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-2xs font-medium ${
                        review.provider === "google"
                          ? "bg-info-soft text-info-foreground border border-info/30"
                          : review.provider === "own"
                            ? "bg-surface-sunken text-text-muted border"
                            : "bg-success-soft text-success-foreground border border-success/30"
                      }`}
                    >
                      {review.provider === "google" ? "Google" : review.provider === "own" ? "Added by you" : "Trustpilot"}
                    </span>

                    <span
                      className={`text-2xs font-medium px-2 py-0.5 rounded-pill ${
                        review.isApproved
                          ? "bg-success-soft text-success-foreground"
                          : "bg-surface-sunken text-text-muted"
                      }`}
                    >
                      {review.isApproved ? "Approved" : "Hidden"}
                    </span>
                  </div>

                  {/* Stars */}
                  {review.rating != null && (
                  <div className="flex items-center gap-1 text-warning">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className="text-xs">
                        {i < (review.rating ?? 0) ? "★" : "☆"}
                      </span>
                    ))}
                    <span className="text-2xs font-medium text-text ml-1">
                      {review.rating}.0
                    </span>
                  </div>
                  )}

                  {/* Review Text */}
                  <p className="text-xs text-text/90 line-clamp-4 leading-relaxed">
                    {review.text || <span className="italic text-text-muted">No review text</span>}
                  </p>
                </div>

                {/* Footer: Author & Controls */}
                <div className="mt-4 pt-3 border-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {review.authorPhotoUrl ? (
                      <img
                        src={review.authorPhotoUrl}
                        alt={review.authorName}
                        className="h-6 w-6 rounded-pill object-cover"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-pill bg-brand-soft text-brand font-medium text-2xs flex items-center justify-center">
                        {review.authorName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="text-left">
                      <p className="text-xs font-medium text-text truncate max-w-[120px]">
                        {review.authorName}
                      </p>
                      {review.reviewDate && (
                        <p className="text-2xs text-text-muted">
                          {new Date(review.reviewDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Approve/Hide Toggle & Delete */}
                  <div className="flex items-center gap-1.5">
                    {review.provider === "own" && (
                      <button type="button" onClick={() => openOwnForm(review)} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 px-2.5 text-2xs")}>
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleToggleApprove(review)}
                      className={cn(buttonVariants({ variant: review.isApproved ? "outline" : "primary", size: "sm" }), "h-7 px-2.5 text-2xs")}
                    >
                      {review.isApproved ? "Hide" : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteReview(review.id)}
                      className={buttonVariants({ variant: "ghost-danger", size: "icon-sm" })}
                      title="Delete review"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
