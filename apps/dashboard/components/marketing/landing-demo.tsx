"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { toggleStyle } from "@/components/ui/toggle";
import { WidgetPreviewFrame } from "@/components/widget/widget-preview-frame";
import { LANDING_DEMO_CONTENT, LANDING_DEMO_LAYOUTS, landingDemoDraft } from "@/lib/landing-demo";
import { cn } from "@/lib/utils";
import { layoutInfo } from "@/lib/widget-editor/layouts";
import type { PreviewDevice } from "@/lib/widget-preview";
import type { WidgetTemplate } from "@/lib/validations/widget-config";

const LIGHT_PAGE = { dark: false };

/** Below Tailwind's `md`, a phone-sized page; a desktop page shrunk to a phone's width would make the widget unreadable. */
function useDevice(): PreviewDevice {
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setDevice(query.matches ? "mobile" : "desktop");
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return device;
}

function SampleLabel({ className }: { className?: string }) {
  return (
    <Badge variant="info" className={className}>
      <Icon name="play-circle" size="sm" /> Live demo · sample content
    </Badge>
  );
}

/** The hero's demo: the real widget on a phone-sized sample page, playing sample videos. */
export function HeroDemo() {
  const draft = useMemo(() => landingDemoDraft("floating-reel"), []);
  return (
    <figure className="relative mx-auto w-full min-w-0 max-w-sm">
      <SampleLabel className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 shadow-sm" />
      <WidgetPreviewFrame
        draft={draft}
        content={LANDING_DEMO_CONTENT}
        device="mobile"
        page={LIGHT_PAGE}
        className="h-[38rem] rounded-panel bg-surface-sunken p-3"
      />
      <figcaption className="mt-3 text-center text-xs text-text-subtle">
        The real widget. Tap a video to play it. People and businesses are made up.
      </figcaption>
    </figure>
  );
}

/** Pick a layout and see the real widget draw it with the same sample videos. */
export function LayoutPicker() {
  const detected = useDevice();
  const [template, setTemplate] = useState<WidgetTemplate>("carousel");
  const [deviceChoice, setDeviceChoice] = useState<PreviewDevice | null>(null);
  const device = deviceChoice ?? detected;
  const info = layoutInfo(template);
  const draft = useMemo(() => landingDemoDraft(template), [template]);

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_1fr] lg:gap-8">
      <div className="min-w-0">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0" role="group" aria-label="Widget layout">
          {LANDING_DEMO_LAYOUTS.map((id) => {
            const layout = layoutInfo(id);
            const active = id === template;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTemplate(id)}
                aria-pressed={active}
                className={cn("shrink-0 rounded-card border px-4 py-2.5 text-left text-sm transition-colors lg:py-3", toggleStyle("choice", active))}
              >
                <span className="block font-medium">{layout.name}</span>
                <span className="mt-0.5 hidden text-xs text-text-muted lg:block">{layout.placement === "floating" ? "Floats in a corner" : "Sits in your page"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {info.name} <SampleLabel />
            </p>
            <p className="text-sm text-text-muted">{info.bestFor}</p>
          </div>
          <div className="flex items-center gap-1 rounded-control bg-surface-sunken p-1" role="group" aria-label="Screen size">
            {(["desktop", "mobile"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDeviceChoice(d)}
                aria-pressed={device === d}
                className={cn("flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs", toggleStyle("raised", device === d))}
              >
                <Icon name={d === "desktop" ? "monitor" : "smartphone"} size="sm" />
                {d === "desktop" ? "Desktop" : "Phone"}
              </button>
            ))}
          </div>
        </div>
        <WidgetPreviewFrame
            draft={draft}
            content={LANDING_DEMO_CONTENT}
            device={device}
            page={LIGHT_PAGE}
            closeUp={info.placement === "floating"}
            className="h-[36rem] rounded-panel bg-surface-sunken p-3 sm:p-4"
          />
      </div>
    </div>
  );
}
