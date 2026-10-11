import { layoutRegistry } from "./layout-api";

/** Replaced at build time with a hash of the build, so a new deploy is never served from a stale cache. */
declare const __VR_BUILD__: string;

/** Layouts being fetched right now, so two widgets that use one layout ask for its file once. */
const pending: Record<string, Promise<boolean>> = {};

/**
 * Loads the chunk for a layout. Resolves true once the layout is registered, false when it cannot be
 * (unknown name, network error); the widget then shows the floating card, which lives in the core.
 * Never rejects: the host page must not see an unhandled error from us.
 */
export function loadLayout(name: string, scriptSrc: string | null | undefined, nonce?: string): Promise<boolean> {
  if (!name || name === "floating-card" || layoutRegistry()[name]) return Promise.resolve(true);
  // The name ends up in a URL, and it can come from an experiment's config: only plain names
  if (!/^[a-z][a-z-]*$/.test(name) || !scriptSrc) return Promise.resolve(false);

  return (pending[name] ||= new Promise((resolve) => {
    try {
      const el = document.createElement("script");
      el.src = new URL(`/widget/layouts/${name}.js?v=${__VR_BUILD__}`, scriptSrc).href;
      el.async = true;
      // Pages with a nonce-based CSP: our own script tag carried a nonce, so the chunk gets the same one
      if (nonce) el.nonce = nonce;
      el.onload = () => resolve(Boolean(layoutRegistry()[name]));
      el.onerror = () => resolve(false);
      document.head.appendChild(el);
    } catch {
      resolve(false);
    }
  }));
}
