"use client";

import { useEffect, useState } from "react";
import { notify } from "@/lib/notify";
import { CopyField, SwitchRow } from "./editor/controls";

/**
 * "Give it a page of its own": the widget on a public page (/wall/{id}) to share by link, for owners with no site
 * to put it on. It shows the widget as last published. Only for widgets that sit in a page.
 */
export function WallShare({ spaceId, widgetId, initialEnabled }: { spaceId: string; widgetId: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);
  useEffect(() => setEnabled(initialEnabled), [initialEnabled]);

  async function change(next: boolean) {
    setBusy(true);
    setEnabled(next);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/widgets/${widgetId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallEnabled: next }) });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error?.message || "Could not change this");
    } catch (err) {
      setEnabled(!next);
      notify.fromError(err, "Could not change this");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-card border p-3">
      <div aria-busy={busy}>
        <SwitchRow label="Give it a page of its own" hint="No website needed: share a link to this widget on its own page." checked={enabled} onChange={change} />
      </div>
      {enabled && (
        <div className="space-y-1.5">
          <CopyField label="Link to share" value={`${origin}/wall/${widgetId}`} />
          <p className="text-2xs text-text-muted">Anyone with the link can see it, and it shows the widget as you last published it. Turn the switch off and the link stops working.</p>
        </div>
      )}
    </div>
  );
}
