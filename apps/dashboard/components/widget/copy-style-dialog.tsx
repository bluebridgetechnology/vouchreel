"use client";

import { useEffect, useState } from "react";
import { layoutInfo } from "@/lib/widget-editor/layouts";
import type { WidgetTemplate } from "@/lib/validations/widget-config";
import { notify } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TargetSpace {
  spaceId: string;
  spaceName: string;
  widgets: { id: string; name: string; template: WidgetTemplate }[];
}

/**
 * "Copy style to...": choose widgets, in this space or the user's other spaces, to give this widget's look.
 * The look goes into each target's draft, so nothing on any site changes until that widget is published.
 */
export function CopyStyleDialog({ spaceId, widget, currentSpaceName, onClose }: { spaceId: string; widget: { id: string; name: string }; currentSpaceName?: string; onClose: () => void }) {
  const [groups, setGroups] = useState<TargetSpace[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const url = `/api/spaces/${spaceId}/widgets/${widget.id}/copy-style`;

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: { spaces: TargetSpace[] }) => !cancelled && setGroups(data.spaces))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url]);

  const key = (space: string, id: string) => `${space}:${id}`;
  const toggle = (k: string, on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });

  async function submit() {
    setSaving(true);
    try {
      const targets = [...picked].map((k) => {
        const [targetSpace, widgetId] = k.split(":");
        return { spaceId: targetSpace, widgetId };
      });
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targets }) });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message || "Could not copy the style");
      const { copied } = (await res.json()) as { copied: unknown[] };
      notify.success(copied.length === 1 ? "Style copied to 1 widget" : `Style copied to ${copied.length} widgets`, { description: "It is in their drafts. Publish each one to show it on your site." });
      onClose();
    } catch (err) {
      notify.fromError(err, "Could not copy the style");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy style from {widget.name}</DialogTitle>
          <DialogDescription>
            Colours, corners, shape, size, shadow, border and motion. What each widget shows and its columns stay as they are. Nothing changes on a site until you publish that widget.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-4 overflow-y-auto" aria-live="polite">
          {failed ? (
            <p role="alert" className="text-sm text-danger-foreground">
              We could not load your widgets. Close this and try again.
            </p>
          ) : groups === null ? (
            <div className="h-16 animate-pulse rounded-card bg-surface-sunken" aria-label="Loading your widgets" />
          ) : groups.length === 0 ? (
            <p className="text-sm text-text-muted">You have no other widgets yet. Add one first, then copy this style onto it.</p>
          ) : (
            groups.map((g) => (
              <fieldset key={g.spaceId} className="space-y-1.5">
                <legend className="mb-1 text-xs font-medium text-text-muted">{g.spaceId === spaceId ? `This space${currentSpaceName ? `: ${currentSpaceName}` : ""}` : g.spaceName}</legend>
                {g.widgets.map((w) => {
                  const k = key(g.spaceId, w.id);
                  const id = `copy-${k}`;
                  return (
                    <label key={k} htmlFor={id} className="flex cursor-pointer items-center gap-3 rounded-control px-2 py-1.5 hover:bg-surface-sunken">
                      <Checkbox id={id} checked={picked.has(k)} onCheckedChange={(v) => toggle(k, v === true)} />
                      <span className="min-w-0 flex-1 truncate text-sm text-text">{w.name}</span>
                      <span className="shrink-0 text-xs text-text-muted">{layoutInfo(w.template).name}</span>
                    </label>
                  );
                })}
              </fieldset>
            ))
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} loading={saving} disabled={saving || picked.size === 0}>
            {picked.size > 1 ? `Copy to ${picked.size} widgets` : "Copy style"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
