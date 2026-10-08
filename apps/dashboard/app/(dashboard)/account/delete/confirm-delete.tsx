"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ConfirmDelete({ token, state, email }: { token: string; state: "invalid" | "wrong-account" | "ready"; email: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Card variant="flat" className="space-y-3 p-4 sm:p-6">
        <h2 className="text-base font-medium">Your account has been deleted</h2>
        <p className="text-sm text-text-muted">Your data was removed and any subscription was cancelled. Files are cleared from storage in the background.</p>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to the homepage
        </Link>
      </Card>
    );
  }

  if (state !== "ready") {
    return (
      <div role="alert" className="space-y-3 rounded-card border border-danger/30 bg-danger-soft p-4 text-sm text-danger-foreground">
        <p>{state === "wrong-account" ? "This link belongs to a different account. Sign in to that account and open the link again." : "This link has expired or is not valid."}</p>
        <Link href="/settings" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to settings
        </Link>
      </div>
    );
  }

  async function deleteNow() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not delete the account");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card variant="flat" className="space-y-4 border-danger/30 p-4 sm:p-6">
      <p className="text-sm text-text-muted">
        You are about to permanently delete <strong className="text-text">{email}</strong>: every space, testimonial, form, video, widget and setting, and your subscription is cancelled.
        <strong className="text-text"> This cannot be undone.</strong>
      </p>
      {error && (
        <div role="alert" className="rounded-control bg-danger-soft px-3.5 py-2.5 text-sm text-danger-foreground">
          {error}
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="danger" loading={busy} onClick={deleteNow}>
          Delete my account forever
        </Button>
        <Link href="/settings" className={buttonVariants({ variant: "outline", size: "md" })}>
          Keep my account
        </Link>
      </div>
    </Card>
  );
}
