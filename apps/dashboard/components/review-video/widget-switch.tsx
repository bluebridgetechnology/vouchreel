"use client";

import { useId, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { notify } from "@/lib/notify";
import { Card } from "@/components/ui/card";

/**
 * "Show in my widget" for a finished video. Off until the owner turns it on. Turning a video off, deleting it,
 * or its removal by our team (or, for an AI video, the customer withdrawing consent) takes it out of the widget.
 */
export function WidgetVideoSwitch({
  endpoint,
  checked,
  isAi = false,
  onChanged,
}: {
  /** PUT { show } here: .../review-videos/:id/widget or .../ai-videos/:id/widget */
  endpoint: string;
  checked: boolean;
  isAi?: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const id = useId();
  const [pending, setPending] = useState(false);

  async function change(show: boolean) {
    setPending(true);
    try {
      const res = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ show }) });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Could not change this.");
      }
      notify.success(show ? "Now shown in your widget. It can take a minute to appear." : "No longer shown in your widget.");
      await onChanged();
    } catch (error) {
      notify.fromError(error, "Could not change this.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card variant="flat" className="flex items-start justify-between gap-4 bg-surface-sunken p-3 text-left">
      <div className="text-xs">
        <label htmlFor={id} className="font-medium text-text">
          Show in my widget
        </label>
        <p className="mt-0.5 text-text-muted">
          Visitors can play it on your site.{isAi ? " It keeps its “AI-generated” label." : ""} Turn it off, or delete the video, and it stops being shown.
        </p>
      </div>
      <Switch id={id} checked={checked} disabled={pending} onCheckedChange={(next) => void change(next)} />
    </Card>
  );
}
