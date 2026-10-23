"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserFrame } from "@/components/marketing/browser-frame";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetPreviewFrame } from "@/components/widget/widget-preview-frame";
import { LANDING_DEMO_CONTENT, landingDemoDraft } from "@/lib/landing-demo";
import { layoutInfo } from "@/lib/widget-editor/layouts";
import type { WidgetTemplate } from "@/lib/validations/widget-config";

const LIGHT_PAGE = { dark: false };

/** How far before it scrolls into view a preview starts loading, so it is ready by the time you reach it. */
const LOAD_MARGIN = "300px";

/**
 * One widget layout, live, in a browser window. The features page shows a dozen of these, and each is a whole page in
 * a frame, so a preview is only loaded once it is about to scroll into view.
 */
export function LayoutPreview({ template }: { template: WidgetTemplate }) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const draft = useMemo(() => landingDemoDraft(template), [template]);
  const floating = layoutInfo(template).placement === "floating";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Without IntersectionObserver (very old browsers) load it straight away
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: LOAD_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      <BrowserFrame>
        {near ? (
          <WidgetPreviewFrame
            draft={draft}
            content={LANDING_DEMO_CONTENT}
            device="desktop"
            page={LIGHT_PAGE}
            closeUp={floating}
            bare
            className="h-[22rem] sm:h-[26rem]"
          />
        ) : (
          <Skeleton className="h-[22rem] w-full rounded-none sm:h-[26rem]" />
        )}
      </BrowserFrame>
    </div>
  );
}
