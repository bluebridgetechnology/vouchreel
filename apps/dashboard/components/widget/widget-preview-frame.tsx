"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { buildPreviewMessage, DEVICES, fitScale, type PreviewContent, type PreviewDevice, type PreviewDraft, type PreviewPage } from "@/lib/widget-preview";

interface WidgetPreviewFrameProps {
  draft: PreviewDraft;
  content: PreviewContent;
  device: PreviewDevice;
  page: PreviewPage;
  /** Bump to play the widget's entrance again. */
  replay?: number;
  className?: string;
}

/** Changes are sent at most this often while the owner drags a slider or types a colour. */
const SEND_DEBOUNCE_MS = 100;

/**
 * The real widget on a sample page, at a device's size, scaled to fit. The page (`/widget/preview.html`) is
 * built with the widget itself, so the preview cannot drift from what visitors see.
 */
export function WidgetPreviewFrame({ draft, content, device, page, replay = 0, className }: WidgetPreviewFrameProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const size = DEVICES[device];
  const scale = fitScale(box, size);

  // The frame says when its script is listening; only messages from our own frame count
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
      if (event.data?.type === "vouchreel:preview-ready") setReady(true);
    };
    window.addEventListener("message", onMessage);
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
        <Card variant="flat" className="overflow-hidden shadow-float" style={{ width: size.width * scale, height: size.height * scale }}>
          <iframe
            ref={frameRef}
            src="/widget/preview.html"
            title={`Widget preview, ${size.label.toLowerCase()} size`}
            sandbox="allow-scripts allow-same-origin allow-popups"
            className="block origin-top-left border-0"
            style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
            // By load the frame's script is listening, even if its "ready" message came before ours was
            onLoad={() => setReady(true)}
          />
        </Card>
      </div>
    </div>
  );
}
