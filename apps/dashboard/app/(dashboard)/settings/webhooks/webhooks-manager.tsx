"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { notify } from "@/lib/notify";
import { useConfirm } from "@/components/ui/confirm";

interface SpaceOption {
  id: string;
  name: string;
}

interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

interface DeliveryItem {
  id: string;
  event: string;
  status: "pending" | "success" | "failed" | "retrying";
  httpStatus: number | null;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  createdAt: string;
  completedAt: string | null;
}

const AVAILABLE_EVENTS = [
  { id: "testimonial.created", label: "testimonial.created (New testimonial added)" },
  { id: "testimonial.updated", label: "testimonial.updated (Testimonial edited)" },
  { id: "testimonial.deleted", label: "testimonial.deleted (Testimonial removed)" },
  { id: "submission.received", label: "submission.received (New customer submission)" },
  { id: "submission.approved", label: "submission.approved (Submission approved)" },
  { id: "conversion.tracked", label: "conversion.tracked (Conversion goal triggered)" },
];

export function WebhooksManager({ spaces }: { spaces: SpaceOption[] }) {
  const confirm = useConfirm();
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(
    spaces[0]?.id || ""
  );
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New webhook modal state
  const [isCreating, setIsCreating] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "testimonial.created",
    "submission.received",
  ]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Inspection modal state
  const [inspectingWebhookId, setInspectingWebhookId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const fetchWebhooks = useCallback(async (spaceId: string) => {
    if (!spaceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/webhooks`);
      if (!res.ok) throw new Error("Failed to load webhooks");
      const data = await res.json();
      setWebhooks(data.webhooks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching webhooks");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDeliveries = useCallback(async (webhookId: string) => {
    if (!selectedSpaceId || !webhookId) return;
    setLoadingDeliveries(true);
    try {
      const res = await fetch(
        `/api/spaces/${selectedSpaceId}/webhooks/${webhookId}/deliveries`
      );
      if (res.ok) {
        const data = await res.json();
        setDeliveries(data.deliveries || []);
      }
    } catch (err) {
      console.error("Failed to load deliveries:", err);
    } finally {
      setLoadingDeliveries(false);
    }
  }, [selectedSpaceId]);

  useEffect(() => {
    if (selectedSpaceId) {
      fetchWebhooks(selectedSpaceId);
    }
  }, [selectedSpaceId, fetchWebhooks]);

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || selectedEvents.length === 0 || !selectedSpaceId) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/spaces/${selectedSpaceId}/webhooks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          events: selectedEvents,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || "Failed to create webhook");
      }

      const data = await res.json();
      setCreatedSecret(data.webhook.secret);
      setUrl("");
      fetchWebhooks(selectedSpaceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating webhook");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!(await confirm({ title: "Delete this webhook endpoint?", description: "Deliveries to its URL will stop immediately.", confirmLabel: "Delete endpoint", tone: "danger" }))) {
      return;
    }

    try {
      const res = await fetch(
        `/api/spaces/${selectedSpaceId}/webhooks/${webhookId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete webhook");
      notify.success("Webhook deleted");
      fetchWebhooks(selectedSpaceId);
      if (inspectingWebhookId === webhookId) {
        setInspectingWebhookId(null);
      }
    } catch (err) {
      notify.fromError(err, "Error deleting webhook");
    }
  };

  const toggleEventSelection = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (spaces.length === 0) {
    return (
      <div className="rounded-card border p-6 text-center text-text-muted">
        You need to create a Space first before configuring webhooks.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Space Selector & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <label htmlFor="spaceSelectWebhooks" className="text-sm font-medium">
            Active Space:
          </label>
          <select
            id="spaceSelectWebhooks"
            value={selectedSpaceId}
            onChange={(e) => setSelectedSpaceId(e.target.value)}
            className={cn(inputClass, "text-sm")}
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            setIsCreating(true);
            setCreatedSecret(null);
          }}
          className={buttonVariants({ variant: "primary", size: "md" })}
        >
          + Add Webhook Endpoint
        </button>
      </div>

      {error && (
        <div className="rounded-control bg-danger-soft p-4 text-sm text-danger-foreground">
          {error}
        </div>
      )}

      {/* Secret Created Banner */}
      {createdSecret && (
        <div className="rounded-card border border-success/30 bg-success-soft p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-success-foreground">
              Webhook Endpoint Added
            </h3>
            <span className="text-xs font-medium text-success-foreground">
              Signing Secret
            </span>
          </div>
          <p className="text-xs text-text-muted">
            Save this signing secret. Incoming webhook requests include an HMAC-SHA256 signature in the <code className="font-mono text-xs">X-Vouchreel-Signature</code> header.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={createdSecret}
              className={cn(inputClass, "flex-1 font-mono text-xs")}
            />
            <button
              onClick={() => copyToClipboard(createdSecret)}
              className={buttonVariants({ variant: "success", size: "sm" })}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Create Webhook Form */}
      {isCreating && !createdSecret && (
        <div className="rounded-card border bg-surface p-4 sm:p-6 shadow-sm space-y-4">
          <h3 className="font-medium text-base">Add Webhook Endpoint</h3>
          <form onSubmit={handleCreateWebhook} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">
                Destination HTTPS URL
              </label>
              <input
                type="url"
                placeholder="https://your-domain.com/webhooks or Zapier/Make URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                className={cn(inputClass, "w-full text-sm")}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-text-muted mb-2">
                Events to Send
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AVAILABLE_EVENTS.map((evt) => (
                  <label
                    key={evt.id}
                    className="flex items-center gap-2 text-xs border rounded-control p-2 hover:bg-surface-sunken cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(evt.id)}
                      onChange={() => toggleEventSelection(evt.id)}
                      className="rounded-control border-border-strong"
                    />
                    <span>{evt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || selectedEvents.length === 0}
                className={buttonVariants({ variant: "primary", size: "sm" })}
              >
                {loading ? "Adding..." : "Add Endpoint"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Webhooks Table */}
      <div className="rounded-card border bg-surface overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface-sunken/50 text-xs font-medium text-text-muted">
            <tr>
              <th className="px-4 py-3">Endpoint URL</th>
              <th className="px-4 py-3">Subscribed Events</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {webhooks.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-text-muted">
                  {loading ? "Loading webhooks..." : "No webhook endpoints configured for this space."}
                </td>
              </tr>
            ) : (
              webhooks.map((w) => (
                <tr key={w.id} className="hover:bg-surface-sunken/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs max-w-xs truncate">
                    {w.url}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex flex-wrap gap-1">
                      {w.events.map((e) => (
                        <span
                          key={e}
                          className="inline-flex items-center rounded-pill bg-surface-sunken px-2 py-0.5 text-2xs font-medium"
                        >
                          {e}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-medium ${
                        w.isActive
                          ? "bg-success-soft text-success-foreground"
                          : "bg-surface-sunken text-text-muted"
                      }`}
                    >
                      {w.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      onClick={() => {
                        setInspectingWebhookId(w.id);
                        fetchDeliveries(w.id);
                      }}
                      className={cn(buttonVariants({ variant: "link", size: "bare" }), "text-xs")}
                    >
                      Logs
                    </button>
                    <button
                      onClick={() => handleDeleteWebhook(w.id)}
                      className={cn(buttonVariants({ variant: "link-danger", size: "bare" }), "text-xs")}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delivery Logs Modal / Panel */}
      {inspectingWebhookId && (
        <div className="rounded-card border bg-surface p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-base">Delivery Logs</h3>
            <button
              onClick={() => setInspectingWebhookId(null)}
              className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-xs")}
            >
              Close
            </button>
          </div>

          {loadingDeliveries ? (
            <p className="text-xs text-text-muted py-4 text-center">
              Loading recent deliveries...
            </p>
          ) : deliveries.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">
              No delivery events logged yet for this endpoint.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-surface-sunken/40">
                  <tr>
                    <th className="px-3 py-2">Event</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">HTTP Code</th>
                    <th className="px-3 py-2">Attempts</th>
                    <th className="px-3 py-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {deliveries.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2 font-mono font-medium">{d.event}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-pill px-1.5 py-0.5 text-2xs font-medium ${
                            d.status === "success"
                              ? "bg-success-soft text-success-foreground"
                              : d.status === "retrying"
                              ? "bg-warning-soft text-warning-foreground"
                              : d.status === "failed"
                              ? "bg-danger-soft text-danger-foreground"
                              : "bg-surface-sunken text-text-muted"
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono">{d.httpStatus || "—"}</td>
                      <td className="px-3 py-2">
                        {d.attemptCount} / {d.maxAttempts}
                      </td>
                      <td className="px-3 py-2 text-text-muted">
                        {new Date(d.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
