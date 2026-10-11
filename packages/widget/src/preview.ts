import { VouchreelWidget, type WidgetConfig, type WidgetWhiteLabelConfig } from "./widget";
import { layoutRegistry } from "./layout-api";
import type { TestimonialItem, ReviewItem } from "./matcher";

/**
 * The dashboard editor's live preview: the real widget, re-rendered on every change.
 *
 * Built into `preview.js` together with every layout chunk (see esbuild.config.mjs), and loaded only by
 * `preview.html`, which the editor frames. It is never served to customer sites and does not count
 * toward the widget's size budget. There is no trigger and no analytics: the widget shows at once.
 */

export interface PreviewMessage {
  type: "vouchreel:preview";
  config: WidgetConfig;
  testimonials: TestimonialItem[];
  reviews?: ReviewItem[];
  whiteLabel?: WidgetWhiteLabelConfig;
  /** The mock page behind the widget, so owners can see it on a page like theirs. */
  page?: { background?: string; dark?: boolean };
}

let current: VouchreelWidget | null = null;

export function renderPreview(message: PreviewMessage): void {
  const page = message.page || {};
  document.body.classList.toggle("dark", Boolean(page.dark));
  document.body.style.background = page.background || "";

  current?.destroy();
  current = null;

  // Inline layouts render in the page's slot; floating ones (and the default card) sit in a corner
  const slot = document.getElementById("vr-slot");
  const inline = Boolean(layoutRegistry()[message.config.template || ""]?.inline);
  slot?.toggleAttribute("data-vouchreel-embed", inline);
  slot?.classList.toggle("vr-slot-empty", !inline);

  current = new VouchreelWidget({
    embedKey: "preview",
    config: message.config,
    testimonials: message.testimonials || [],
    reviews: message.reviews || [],
    whiteLabel: message.whiteLabel,
  });
  current.mount();
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (event: MessageEvent) => {
    // Only the dashboard that framed us may drive the preview
    if (event.origin !== window.location.origin || event.data?.type !== "vouchreel:preview") return;
    renderPreview(event.data as PreviewMessage);
  });
  window.parent?.postMessage({ type: "vouchreel:preview-ready" }, window.location.origin);
}
