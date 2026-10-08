"use client";

import { useEffect, useMemo, useState } from "react";
import type { TriggerType, WidgetPosition, WidgetTemplate, WidgetTheme } from "@/lib/validations/widget-config";
import { cn } from "@/lib/utils";
import { toggleStyle } from "@/components/ui/toggle";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { WidgetPreviewFrame } from "./widget-preview-frame";
import { DEVICES, previewContentFrom, SAMPLE_CONTENT, triggerLabel, type PreviewContent, type PreviewDevice } from "@/lib/widget-preview";

interface LivePreviewProps {
  /** The space's embed key: the preview shows its published testimonials and reviews. */
  embedKey?: string;
  template?: WidgetTemplate;
  position: WidgetPosition;
  theme: WidgetTheme;
  triggerType: TriggerType;
  triggerValue: Record<string, unknown>;
  autoplayPreview: boolean;
  onAutoplayChange?: (enabled: boolean) => void;
}

const DEVICE_ICONS = { desktop: "monitor", tablet: "tablet", mobile: "smartphone" } as const;

export function LivePreview({
  embedKey,
  template = "floating-card",
  position,
  theme,
  triggerType,
  triggerValue,
  autoplayPreview,
  onAutoplayChange,
}: LivePreviewProps) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [darkPage, setDarkPage] = useState(false);
  const [replay, setReplay] = useState(0);
  const [content, setContent] = useState<PreviewContent>(SAMPLE_CONTENT);

  // What visitors would see: the published items from the public widget endpoint, else samples
  useEffect(() => {
    if (!embedKey) return;
    let cancelled = false;
    fetch(`/api/widget/${encodeURIComponent(embedKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => !cancelled && setContent(previewContentFrom(data)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [embedKey]);

  const draft = useMemo(() => ({ template, position, theme, autoplayPreview }), [template, position, theme, autoplayPreview]);
  const page = useMemo(() => ({ dark: darkPage }), [darkPage]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-2 w-2 shrink-0 animate-pulse rounded-pill bg-success" />
          <span className="text-xs font-medium text-text">Live preview</span>
          <span className="hidden rounded-control bg-surface-sunken px-2 py-0.5 text-2xs font-medium text-text-muted sm:inline-block">
            {triggerLabel(triggerType, triggerValue)}
          </span>
          {content.sample && <Badge variant="info">Sample content</Badge>}
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-card border bg-surface-sunken/30 p-1" role="group" aria-label="Screen size">
            {(Object.keys(DEVICES) as PreviewDevice[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDevice(d)}
                aria-pressed={device === d}
                aria-label={DEVICES[d].label}
                title={DEVICES[d].label}
                className={cn("flex items-center rounded-control p-1.5 transition-all", toggleStyle("raised", device === d))}
              >
                <Icon name={DEVICE_ICONS[d]} size="sm" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setDarkPage((v) => !v)}
            aria-pressed={darkPage}
            aria-label="Dark page background"
            title={darkPage ? "Show on a light page" : "Show on a dark page"}
            className={cn("flex items-center rounded-control border p-1.5 transition-all", toggleStyle("raised", darkPage))}
          >
            <Icon name={darkPage ? "moon" : "sun"} size="sm" />
          </button>
          <button
            type="button"
            onClick={() => setReplay((n) => n + 1)}
            aria-label="Replay entrance"
            title="Replay entrance"
            className={cn("flex items-center rounded-control border p-1.5 transition-all", toggleStyle("raised", false))}
          >
            <Icon name="restart" size="sm" />
          </button>
        </div>
      </div>

      <WidgetPreviewFrame
        draft={draft}
        content={content}
        device={device}
        page={page}
        replay={replay}
        className="h-[min(72vh,640px)] rounded-card border bg-surface-sunken/40 p-3"
      />

      <div className="flex flex-col gap-2 rounded-card border bg-surface p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <span className="font-medium text-text">Autoplay video previews</span>
          <p className="text-2xs text-text-muted">A muted preview loop plays in the player to catch visitors&apos; attention.</p>
        </div>
        <Switch checked={autoplayPreview} onCheckedChange={(v) => onAutoplayChange?.(v)} aria-label="Autoplay video previews" />
      </div>

      <p className="text-center text-2xs text-text-muted">
        This is the real widget. Click it to try the player; triggers are skipped here so it shows at once.
      </p>
    </div>
  );
}
