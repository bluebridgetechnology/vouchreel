"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buildPreviewMessage, DEVICES, fitScale, type PreviewContent, type PreviewDevice, type PreviewDraft, type PreviewPage } from "@/lib/widget-preview";

interface WidgetPreviewFrameProps {
  draft: PreviewDraft;
  content: PreviewContent;
  device: PreviewDevice;
  page: PreviewPage;
  /** Bump to play the widget's entrance again. */
  replay?: number;
  /**
   * Close-up: a smaller window (as a visitor with a narrow browser would have) enlarged to fill the space, instead of
   * a whole desktop page shrunk to fit. A small floating widget is then big enough to judge, and its player and
   * pop-ups still open in the middle of what is shown, not off to the side.
   */
  closeUp?: boolean;
  className?: string;
}

/** The most a close-up enlarges the page, and the narrowest window it pretends to be (below this the widget would switch to its phone layout). */
const CLOSE_UP_MAX_SCALE = 1.5;
const CLOSE_UP_MIN_WIDTH = 640;

/** Changes are sent at most this often while the owner drags a slider or types a colour. */
const SEND_DEBOUNCE_MS = 100;

/**
 * The real widget on a sample page, at a device's size, scaled to fit. The page (`/widget/preview.html`) is
 * built with the widget itself, so the preview cannot drift from what visitors see.
 */
export function WidgetPreviewFrame({ draft, content, device, page, replay = 0, closeUp = false, className }: WidgetPreviewFrameProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const size = DEVICES[device];
  // A phone is already shown at its own size, so a close-up only means something for the wider screens
  const zoomed = closeUp && device !== "mobile";
  const scale = zoomed ? Math.min(CLOSE_UP_MAX_SCALE, Math.max(1, box.width / CLOSE_UP_MIN_WIDTH)) : fitScale(box, size);
  // The page is as wide as the device but as tall as the space allows, so the preview fills its area (a tall column of
  // cards, a wall) instead of leaving an empty band under a 16:10 page
  const pageWidth = zoomed && box.width > 0 ? Math.floor(box.width / scale) : size.width;
  const pageHeight = box.height <= 0 ? size.height : zoomed ? Math.floor(box.height / scale) : Math.max(size.height, Math.floor(box.height / scale));

  // The frame says when its script is listening; only messages from our own frame count
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === "vouchreel:preview-ready") setReady(true);
    };
    window.addEventListener("message", onMessage);
    // On a server-rendered page the frame can finish loading before React hydrates, so both its "ready"
    // message and its load event come before anyone is listening: a frame that has already loaded is ready
    if (frameRef.current?.contentDocument?.readyState === "complete" && frameRef.current.contentWindow?.location.href !== "about:blank") setReady(true);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      frameRef.current?.contentWindow?.postMessage(buildPreviewMessage(draft, content, page), window.location.origin);
    }, SEND_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [ready, draft, content, page, replay]);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={className}>
      <div ref={boxRef} className="flex h-full w-full items-start justify-center">
        <Card
          variant="flat"
          className="overflow-hidden shadow-float"
          // Empty until measured: server-rendered, it would first paint at full device size (wider than a phone) and then shrink
          style={box.width <= 0 ? { width: 0, height: 0, visibility: "hidden" } : zoomed ? { width: "100%", height: "100%" } : { width: size.width * scale, height: pageHeight * scale }}
        >
          <iframe
            ref={frameRef}
            src="/widget/preview.html"
            title={`Widget preview, ${size.label.toLowerCase()} size${zoomed ? ", close-up" : ""}`}
            sandbox="allow-scripts allow-same-origin allow-popups"
            className="block max-w-none origin-top-left border-0"
            style={{ width: pageWidth, height: pageHeight, transform: `scale(${scale})` }}
            // By load the frame's script is listening, even if its "ready" message came before ours was
            onLoad={() => setReady(true)}
          />
        </Card>
      </div>
    </div>
  );
}
