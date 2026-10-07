"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function DeleteAccountCard({ needsPassword }: { needsPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsPassword ? { password } : {}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not start deleting your account");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start deleting your account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-card border border-danger/30 bg-surface p-4 sm:p-6 md:col-span-2">
      <h2 className="text-base font-medium">Delete account</h2>
      <p className="text-sm text-text-muted">Permanently deletes your account and everything in it. We email you a link to confirm. You can also download your data first (see below).</p>
      {sent ? (
        <p role="status" className="text-sm text-text">We sent a confirmation link to your email. It works for one hour.</p>
      ) : !open ? (
        <Button variant="outline-danger" size="sm" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      ) : (
        <form onSubmit={submit} className="max-w-sm space-y-3">
          {error && (
            <div role="alert" className="rounded-control bg-danger-soft px-3.5 py-2.5 text-sm text-danger-foreground">
              {error}
            </div>
          )}
          {needsPassword && (
            <Field label="Your password" htmlFor="delete-password">
              <Input id="delete-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
          )}
          <div className="flex gap-2">
            <Button type="submit" variant="danger" size="sm" loading={busy}>
              Email me the link
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
