"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { seenHeadline, seenRow, suggestedUrl } from "@/lib/install/format";
import type { InstallCheckResult } from "@/lib/install/check";
import type { SeenOn } from "@/lib/install/status";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { inputClass } from "@/components/ui/input";

/** The server's answer, or a plain sentence about why we have none. */
async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return data?.error?.details?.url?.[0] || data?.error?.message || fallback;
}

/**
 * "Is it on your site?": where this space's widgets (or one widget) have really been shown to visitors, which is
 * the proof, and a check that loads a page of the owner's site and looks for the script and the widget's spot.
 * Pass `widgetId` for one widget; leave it out for the whole space.
 */
export function InstallCheck({ spaceId, widgetId }: { spaceId: string; widgetId?: string }) {
  const urlId = useId();
  const [seen, setSeen] = useState<SeenOn[] | null>(null);
  const [seenError, setSeenError] = useState(false);
  const [url, setUrl] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<InstallCheckResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const loadSeen = useCallback(async () => {
    setSeenError(false);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/install/status${widgetId ? `?widgetId=${widgetId}` : ""}`);
      if (!res.ok) throw new Error();
      const { seen: list } = (await res.json()) as { seen: SeenOn[] };
      setSeen(list);
      // Offer the site it was last seen on, unless the owner has already typed something
      setUrl((current) => current || suggestedUrl(list));
    } catch {
      setSeenError(true);
    }
  }, [spaceId, widgetId]);

  useEffect(() => {
    loadSeen();
  }, [loadSeen]);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setResult(null);
    setFailure(null);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/install/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, ...(widgetId ? { widgetId } : {}) }),
      });
      if (!res.ok) throw new Error(await readError(res, "The check could not be run."));
      setResult((await res.json()) as InstallCheckResult);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "The check could not be run.");
    } finally {
      setChecking(false);
    }
  }

  const scope = widgetId ? "widget" : "space";

  return (
    <Card variant="sunken" padding="sm" className="space-y-4 border">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-sm font-medium text-text">Is it on your site?</h4>
          <button type="button" onClick={loadSeen} className={cn(buttonVariants({ variant: "link-muted", size: "bare" }), "text-xs font-medium underline")}>
            Refresh
          </button>
        </div>
        {seenError ? (
          <p role="alert" className="text-xs text-danger-foreground">
            We could not look this up. Try Refresh.
          </p>
        ) : seen === null ? (
          <div className="h-4 w-2/3 animate-pulse rounded-control bg-surface-sunken" aria-label="Looking up where it has been seen" />
        ) : (
          <>
            <p className="flex items-start gap-1.5 text-xs text-text-muted" aria-live="polite">
              <Icon name={seen.length > 0 ? "check-circle" : "clock-circle"} size="sm" className={cn("shrink-0", seen.length > 0 ? "text-success-foreground" : "text-text-subtle")} />
              {seenHeadline(seen, scope)}
            </p>
            {seen.length > 1 && (
              <ul className="space-y-0.5 pl-6 text-2xs text-text-muted">
                {seen.map((s) => (
                  <li key={s.host}>{seenRow(s)}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <form onSubmit={check} className="space-y-2">
        <label htmlFor={urlId} className="block text-xs font-medium text-text">
          Check a page
        </label>
        <div className="flex gap-2">
          <input
            id={urlId}
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://yoursite.com/pricing"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={cn(inputClass, "h-9 min-w-0 flex-1 text-xs")}
          />
          <Button type="submit" size="sm" variant="outline" loading={checking} disabled={checking || !url.trim()}>
            Check
          </Button>
        </div>
        <p className="text-2xs text-text-muted">We load the page and look for your script{widgetId ? " and this widget's spot" : ""}. Seeing it in "last seen" above is the surer proof.</p>
      </form>

      <div aria-live="polite" className="space-y-2">
        {failure && (
          <p role="alert" className="flex items-start gap-1.5 text-xs text-danger-foreground">
            <Icon name="close-circle" size="sm" className="shrink-0" />
            {failure}
          </p>
        )}
        {result && !result.reachable && (
          <p role="alert" className="flex items-start gap-1.5 text-xs text-danger-foreground">
            <Icon name="close-circle" size="sm" className="shrink-0" />
            {result.problem}
          </p>
        )}
        {result?.reachable && (
          <ul className="space-y-1.5">
            {result.lines.map((line) => (
              <li key={line.text} className={cn("flex items-start gap-1.5 text-xs", line.ok === false ? "text-danger-foreground" : line.ok ? "text-text" : "text-text-muted")}>
                <Icon name={line.ok === false ? "close-circle" : line.ok ? "check-circle" : "info-circle"} size="sm" className={cn("shrink-0", line.ok && "text-success-foreground")} />
                {line.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
