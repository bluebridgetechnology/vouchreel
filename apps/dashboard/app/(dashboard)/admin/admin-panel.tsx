"use client";

import { useState } from "react";

interface AdminPanelProps {
  initialProvider: "stripe" | "dodo";
  appUrl: string;
}

export function AdminPanel({ initialProvider, appUrl }: AdminPanelProps) {
  const [provider, setProvider] = useState<"stripe" | "dodo">(initialProvider);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [copiedStripe, setCopiedStripe] = useState(false);
  const [copiedDodo, setCopiedDodo] = useState(false);

  const stripeWebhookUrl = `${appUrl}/api/webhooks/stripe`;
  const dodoWebhookUrl = `${appUrl}/api/webhooks/dodo`;

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_provider: provider }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to update settings");
      }

      setMessage({
        text: `Active payment provider updated to ${
          provider === "dodo" ? "Dodo Payments" : "Stripe"
        }. New checkouts will immediately use this provider.`,
        type: "success",
      });
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Error saving settings",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  function copyToClipboard(text: string, type: "stripe" | "dodo") {
    navigator.clipboard.writeText(text);
    if (type === "stripe") {
      setCopiedStripe(true);
      setTimeout(() => setCopiedStripe(false), 2000);
    } else {
      setCopiedDodo(true);
      setTimeout(() => setCopiedDodo(false), 2000);
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {message && (
        <div
          role="status"
          className={`rounded-card border p-4 text-sm ${
            message.type === "success"
              ? "border-success/30 bg-success-soft text-success-foreground"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Payment Provider Selection */}
      <div className="rounded-card border bg-card p-4 sm:p-6 shadow-sm">
        <h2 className="text-xl font-medium">Active Payment Provider</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which payment processor is used for newly created checkout sessions.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stripe Option */}
          <label
            className={`relative flex cursor-pointer flex-col rounded-card border p-5 transition-all ${
              provider === "stripe"
                ? "border-primary bg-primary/5 ring-2 ring-primary"
                : "border-border hover:bg-accent/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="payment_provider"
                  value="stripe"
                  checked={provider === "stripe"}
                  onChange={() => setProvider("stripe")}
                  className="h-4 w-4 text-primary focus:ring-primary"
                />
                <span className="font-medium">Stripe</span>
              </div>
              <span className="rounded-control bg-info-soft px-2 py-0.5 text-xs font-medium text-info-foreground">
                Default
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Direct merchant processing via Stripe Checkout. Requires configured Stripe API keys and price IDs.
            </p>
          </label>

          {/* Dodo Option */}
          <label
            className={`relative flex cursor-pointer flex-col rounded-card border p-5 transition-all ${
              provider === "dodo"
                ? "border-primary bg-primary/5 ring-2 ring-primary"
                : "border-border hover:bg-accent/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  name="payment_provider"
                  value="dodo"
                  checked={provider === "dodo"}
                  onChange={() => setProvider("dodo")}
                  className="h-4 w-4 text-primary focus:ring-primary"
                />
                <span className="font-medium">Dodo Payments</span>
              </div>
              <span className="rounded-control bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-foreground">
                MoR
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Merchant of Record solution handling global sales tax, VAT, and international payment methods.
            </p>
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-control bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving changes..." : "Save Provider Configuration"}
          </button>
        </div>
      </div>

      {/* Webhook Endpoints Info */}
      <div className="rounded-card border bg-card p-4 sm:p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-xl font-medium">Registered Webhook Endpoints</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Both webhook endpoints remain permanently active so event notifications are never missed
            even if you switch active providers. Configure these in your respective provider dashboards.
          </p>
        </div>

        {/* Stripe Webhook */}
        <div className="space-y-2 rounded-card border p-4 bg-muted/40">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Stripe Webhook URL</span>
            <button
              type="button"
              onClick={() => copyToClipboard(stripeWebhookUrl, "stripe")}
              className="text-xs font-medium text-primary hover:underline"
            >
              {copiedStripe ? "Copied!" : "Copy URL"}
            </button>
          </div>
          <code className="block rounded-control bg-background p-2 text-xs font-mono text-foreground border break-all">
            {stripeWebhookUrl}
          </code>
          <p className="text-xs text-muted-foreground">
            Events to listen for: <code className="text-xs font-mono">checkout.session.completed</code>,{" "}
            <code className="text-xs font-mono">customer.subscription.updated</code>,{" "}
            <code className="text-xs font-mono">customer.subscription.deleted</code>,{" "}
            <code className="text-xs font-mono">invoice.payment_failed</code>.
          </p>
        </div>

        {/* Dodo Webhook */}
        <div className="space-y-2 rounded-card border p-4 bg-muted/40">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Dodo Payments Webhook URL</span>
            <button
              type="button"
              onClick={() => copyToClipboard(dodoWebhookUrl, "dodo")}
              className="text-xs font-medium text-primary hover:underline"
            >
              {copiedDodo ? "Copied!" : "Copy URL"}
            </button>
          </div>
          <code className="block rounded-control bg-background p-2 text-xs font-mono text-foreground border break-all">
            {dodoWebhookUrl}
          </code>
          <p className="text-xs text-muted-foreground">
            Events to listen for: <code className="text-xs font-mono">payment.succeeded</code>,{" "}
            <code className="text-xs font-mono">subscription.active</code>,{" "}
            <code className="text-xs font-mono">subscription.updated</code>,{" "}
            <code className="text-xs font-mono">subscription.cancelled</code>,{" "}
            <code className="text-xs font-mono">subscription.past_due</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
