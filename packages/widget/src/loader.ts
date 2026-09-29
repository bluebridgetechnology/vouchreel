import { filterTestimonials, isPageAllowed, TestimonialItem } from "./matcher";
import { setupTrigger, isDismissed, TriggerType } from "./triggers";
import { AnalyticsTracker, ConversionGoal } from "./analytics";
import { VouchreelWidget, WidgetConfig } from "./widget";

export interface WidgetApiResponse {
  spaceId: string;
  config: WidgetConfig & {
    trigger?: {
      type: TriggerType;
      value?: Record<string, unknown>;
    };
    pagesIncluded?: string[];
    pagesExcluded?: string[];
  };
  testimonials: TestimonialItem[];
  conversionGoals?: ConversionGoal[];
}

/**
 * Discovers the script tag that loaded the widget and extracts configuration.
 */
export function findScriptElement(): HTMLScriptElement | null {
  if (typeof document === "undefined") return null;

  if (document.currentScript instanceof HTMLScriptElement) {
    return document.currentScript;
  }

  // Fallback search
  return (
    document.querySelector<HTMLScriptElement>("script[data-key]") ||
    document.querySelector<HTMLScriptElement>("script[src*='vouchreel']") ||
    document.querySelector<HTMLScriptElement>("script[src*='widget']") ||
    null
  );
}

/**
 * Extracts embedKey from script tag data-key attribute or script src path/query.
 */
export function extractEmbedKey(script: HTMLScriptElement | null): string | null {
  if (!script) return null;

  // 1. data-key attribute
  const dataKey = script.getAttribute("data-key");
  if (dataKey && dataKey.trim().length > 0) {
    return dataKey.trim();
  }

  // 2. script src path: e.g. /widget/{embedKey}.js or /widget/{embedKey}
  const src = script.getAttribute("src") || script.src;
  if (src) {
    try {
      const parsedUrl = new URL(src, window.location.href);
      const pathname = parsedUrl.pathname;
      const match = pathname.match(/\/widget\/([^/.]+)(?:\.js)?$/);
      if (match && match[1] && match[1] !== "vouchreel-widget") {
        return match[1];
      }

      // 3. Query param: ?key=... or ?embedKey=...
      const queryKey =
        parsedUrl.searchParams.get("key") ||
        parsedUrl.searchParams.get("embedKey") ||
        parsedUrl.searchParams.get("k");
      if (queryKey) {
        return queryKey.trim();
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Extracts API base URL from script tag or defaults to script origin.
 */
export function extractApiBase(script: HTMLScriptElement | null): string {
  if (script) {
    const dataApi = script.getAttribute("data-api");
    if (dataApi && dataApi.trim().length > 0) {
      return dataApi.trim().replace(/\/+$/, "");
    }

    const src = script.getAttribute("src") || script.src;
    if (src) {
      try {
        const parsed = new URL(src, window.location.href);
        // If script is from another domain, use that as API origin
        if (parsed.origin && parsed.origin !== "null") {
          return parsed.origin;
        }
      } catch {
        // ignore
      }
    }
  }

  return typeof window !== "undefined" && window.location ? window.location.origin : "";
}

/**
 * Main widget loader entrypoint.
 * Guaranteed to never throw unhandled exceptions on the host page.
 */
export async function initLoader(): Promise<void> {
  try {
    const script = findScriptElement();
    const embedKey = extractEmbedKey(script);
    if (!embedKey) {
      return;
    }

    // Check if dismissed in this session
    if (isDismissed(embedKey)) {
      return;
    }

    const apiBase = extractApiBase(script);
    const endpoint = `${apiBase}/api/widget/${encodeURIComponent(embedKey)}`;

    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return;
    }

    const data: WidgetApiResponse = await response.json();
    if (!data || !data.config || !Array.isArray(data.testimonials)) {
      return;
    }

    const currentPath =
      typeof window !== "undefined" && window.location
        ? window.location.pathname
        : "/";

    // Check page targeting rules
    if (!isPageAllowed(data.config, currentPath)) {
      return;
    }

    // Filter matching testimonials
    const matchingTestimonials = filterTestimonials(
      data.testimonials,
      typeof window !== "undefined" ? window.location : { pathname: "/" }
    );

    if (matchingTestimonials.length === 0) {
      return;
    }

    // Initialize analytics tracker
    const analytics = new AnalyticsTracker({
      spaceId: data.spaceId,
      apiBase,
      conversionGoals: data.conversionGoals,
    });

    // Expose global conversion pixel function:
    // <script>window.vouchreelConvert && window.vouchreelConvert('goal-id');</script>
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).vouchreelConvert =
        (goalId: string) => {
          analytics.track("convert", null, { goalId, source: "pixel" });
        };
    }

    // Create widget instance
    const widget = new VouchreelWidget({
      embedKey,
      config: data.config,
      testimonials: matchingTestimonials,
      analytics,
    });

    // Determine trigger configuration
    const triggerType = data.config.trigger?.type || "delay";
    const triggerValue = data.config.trigger?.value || null;

    // Activate trigger
    setupTrigger({
      type: triggerType,
      value: triggerValue,
      embedKey,
      onTrigger: () => {
        widget.mount();
      },
    });
  } catch {
    // Fail silently to safeguard host page execution
  }
}

/**
 * Boots the widget when DOM is ready.
 */
export function startWidget(): void {
  if (typeof document === "undefined") return;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initLoader();
    });
  } else {
    // Defer slightly to ensure host page layout has settled
    setTimeout(() => {
      initLoader();
    }, 10);
  }
}
