"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { toggleStyle } from "@/components/ui/toggle";
import { WidgetPreviewFrame } from "@/components/widget/widget-preview-frame";
import { LANDING_DEMO_CONTENT, LANDING_DEMO_LAYOUTS, landingDemoDraft } from "@/lib/landing-demo";
import { cn } from "@/lib/utils";
import { layoutInfo } from "@/lib/widget-editor/layouts";
import type { PreviewDevice } from "@/lib/widget-preview";
import type { WidgetTemplate } from "@/lib/validations/widget-config";

const LIGHT_PAGE = { dark: false };

const GROUPS = [
  { label: "Floats on your page", placement: "floating" },
  { label: "Sits in your page", placement: "inline" },
] as const;

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

/** Pick a layout and see the real widget draw it with the same sample videos. */
export function LayoutPicker() {
  const detected = useDevice();
  const [template, setTemplate] = useState<WidgetTemplate>("carousel");
  const [deviceChoice, setDeviceChoice] = useState<PreviewDevice | null>(null);
  const device = deviceChoice ?? detected;
  const info = layoutInfo(template);
  const draft = useMemo(() => landingDemoDraft(template), [template]);

  return (
    <div className="space-y-6">
      {/* Layouts, grouped by where they sit */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-center lg:gap-10">
        {GROUPS.map((group) => (
          <div key={group.placement} className="min-w-0">
            <p className="mb-2 text-center text-2xs uppercase tracking-widest text-text-subtle lg:text-left">{group.label}</p>
            <div
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0 lg:justify-start"
              role="group"
              aria-label={group.label}
            >
              {LANDING_DEMO_LAYOUTS.filter((id) => layoutInfo(id).placement === group.placement).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTemplate(id)}
                  aria-pressed={id === template}
                  className={cn("shrink-0 rounded-pill border px-4 py-2 text-sm transition-colors", toggleStyle("choice", id === template))}
                >
                  {layoutInfo(id).name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* The stage */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Badge variant="info">
              <Icon name="play-circle" size="sm" /> Live demo · sample content
            </Badge>
            <span className="text-sm text-text-muted">
              <span className="font-medium text-text">{info.name}</span> · {info.bestFor.split(": ")[1] ?? info.bestFor}
            </span>
          </div>
          <div className="flex items-center gap-1 rounded-control bg-surface-sunken p-1" role="group" aria-label="Screen size">
            {(["desktop", "mobile"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDeviceChoice(d)}
                aria-pressed={device === d}
                className={cn("flex items-center gap-1.5 rounded-control px-3 py-1.5 text-xs", toggleStyle("solid", device === d))}
              >
                <Icon name={d === "desktop" ? "monitor" : "smartphone"} size="sm" />
                {d === "desktop" ? "Desktop" : "Phone"}
              </button>
            ))}
          </div>
        </div>
        <BrowserFrame className={cn(device === "mobile" && "mx-auto max-w-sm")}>
          <WidgetPreviewFrame
            draft={draft}
            content={LANDING_DEMO_CONTENT}
            device={device}
            page={LIGHT_PAGE}
            closeUp={info.placement === "floating"}
            bare
            className="h-[32rem] sm:h-[38rem]"
          />
        </BrowserFrame>
      </div>

      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-sm text-text-muted">
          This is the real widget. Click a video to play it. The people and businesses are made up.
        </p>
        <Button asChild variant="outline">
          <Link href="/signup">
            Use {info.name.toLowerCase()} on your site <Icon name="arrow-right" size="sm" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
