"use client";

import { useCallback, useEffect, useState } from "react";
import { buttonVariants, Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/time-ago";

interface ExportState {
  id: string;
  status: "queued" | "ready" | "failed";
  sizeBytes: number | null;
  error: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export function DataExportCard() {
  const [state, setState] = useState<ExportState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/account/export");
    if (res.ok) setState((await res.json()).export ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // While it is being built, look again every few seconds
  useEffect(() => {
    if (state?.status !== "queued") return;
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [state?.status, load]);

  async function request() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/export", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Could not start your data export");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start your data export");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-card border bg-surface p-4 sm:p-6 md:col-span-2">
      <h2 className="text-base font-medium">Download your data</h2>
      <p className="text-sm text-text-muted">
        A zip with your spaces, testimonials, forms and submissions, consent records, videos, settings and notifications as JSON files. Secrets such as API key hashes are left out. One request a day.
      </p>
      {error && (
        <div role="alert" className="rounded-control bg-danger-soft px-3.5 py-2.5 text-sm text-danger-foreground">
          {error}
        </div>
      )}
      {state?.status === "queued" && <p className="text-sm text-text-muted">Preparing your data… this usually takes under a minute.</p>}
      {state?.status === "failed" && <p className="text-sm text-danger-foreground">The last export failed: {state.error ?? "unknown error"}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {state?.status === "ready" && (
          <a href={`/api/account/export/${state.id}`} className={buttonVariants({ variant: "primary", size: "sm" })} download>
            Download ({Math.max(1, Math.round((state.sizeBytes ?? 0) / 1024))} KB)
          </a>
        )}
        <Button variant="outline" size="sm" loading={busy} disabled={state?.status === "queued"} onClick={request}>
          {state ? "Prepare a new copy" : "Prepare my data"}
        </Button>
        {state?.status === "ready" && state.expiresAt && <span className="text-xs text-text-muted">Ready {timeAgo(new Date(state.createdAt))}; available until {new Date(state.expiresAt).toLocaleDateString()}.</span>}
      </div>
    </div>
  );
}
