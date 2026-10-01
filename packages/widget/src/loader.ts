import { filterTestimonials, filterReviews, isPageAllowed, TestimonialItem, ReviewItem } from "./matcher";
import { setupTrigger, isDismissed, TriggerType } from "./triggers";
import { AnalyticsTracker, ConversionGoal, getOrCreateSessionId } from "./analytics";
import { VouchreelWidget, WidgetConfig } from "./widget";

export interface ExperimentVariant {
  id: string;
  name: string;
  config: Record<string, unknown>;
}

export interface ActiveExperiment {
  id: string;
  name: string;
  type: "trigger" | "position" | "template";
  variants: ExperimentVariant[];
  trafficSplit: number[];
}

export interface WidgetApiResponse {
  spaceId: string;
  config: WidgetConfig & {
    template?: string;
    trigger?: {
      type: TriggerType;
      value?: Record<string, unknown>;
    };
    pagesIncluded?: string[];
    pagesExcluded?: string[];
  };
  testimonials: TestimonialItem[];
  reviews?: ReviewItem[];
  conversionGoals?: ConversionGoal[];
  activeExperiment?: ActiveExperiment | null;
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
 * 32-bit FNV-1a hash function for fast, deterministic variant assignment.
 */
export function hashExperiment(sessionId: string, experimentId: string): number {
  const str = `${sessionId}:${experimentId}`;
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Assigns a variant index deterministically across traffic split cumulative thresholds.
 */
export function assignVariant(
  sessionId: string,
  experimentId: string,
  trafficSplit: number[],
  numVariants: number
): number {
  if (!trafficSplit || trafficSplit.length === 0 || numVariants <= 0) return 0;
  const hash = hashExperiment(sessionId, experimentId);
  const bucket = hash % 100;
  let cumulative = 0;
  for (let i = 0; i < trafficSplit.length; i++) {
    cumulative += trafficSplit[i];
    if (bucket < cumulative) {
      return i < numVariants ? i : 0;
    }
  }
  return Math.min(trafficSplit.length - 1, numVariants - 1);
}

/**
 * Retrieves cached variant assignment from sessionStorage or determines and saves new assignment.
 */
export function getOrAssignVariant(
  sessionId: string,
  experiment: ActiveExperiment
): number {
  const storageKey = `vr_exp_${experiment.id}`;
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      if (stored !== null && stored !== undefined) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed < experiment.variants.length) {
          return parsed;
        }
      }
    } catch {
      // sessionStorage unavailable
    }
  }

  const assigned = assignVariant(
    sessionId,
    experiment.id,
    experiment.trafficSplit,
    experiment.variants.length
  );

  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(storageKey, String(assigned));
    } catch {
      // sessionStorage write blocked
    }
  }

  return assigned;
}

/**
 * Merges the assigned variant configuration onto data.config.
 */
export function applyVariantConfig(
  config: WidgetApiResponse["config"],
  experiment: ActiveExperiment,
  variantIndex: number
): void {
  const variant = experiment.variants[variantIndex];
  if (!variant || !variant.config) return;

  const vConfig = variant.config;
  if (experiment.type === "trigger") {
    if (vConfig.trigger && typeof vConfig.trigger === "object") {
      config.trigger = vConfig.trigger as { type: TriggerType; value?: Record<string, unknown> };
    } else if (vConfig.type || vConfig.triggerType) {
      config.trigger = {
        type: (vConfig.type || vConfig.triggerType) as TriggerType,
        value: (vConfig.value || vConfig.triggerValue || {}) as Record<string, unknown>,
      };
    } else {
      config.trigger = vConfig as unknown as { type: TriggerType; value?: Record<string, unknown> };
    }
  } else if (experiment.type === "position") {
    const pos = (vConfig.position ?? vConfig.value ?? (typeof vConfig === "string" ? vConfig : null)) as any;
    if (pos) {
      config.position = pos;
    }
  } else if (experiment.type === "template") {
    const tmpl = (vConfig.template ?? vConfig.value ?? (typeof vConfig === "string" ? vConfig : null)) as any;
    if (tmpl) {
      config.template = tmpl;
    }
  } else {
    Object.assign(config, vConfig);
  }
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

    // Process active A/B testing experiment if present
    let activeExperimentId: string | null = null;
    let activeVariantIndex: number | null = null;

    if (
      data.activeExperiment &&
      Array.isArray(data.activeExperiment.variants) &&
      data.activeExperiment.variants.length > 0
    ) {
      const sessionId = getOrCreateSessionId();
      activeExperimentId = data.activeExperiment.id;
      activeVariantIndex = getOrAssignVariant(sessionId, data.activeExperiment);
      applyVariantConfig(data.config, data.activeExperiment, activeVariantIndex);
    }

    const currentPath =
      typeof window !== "undefined" && window.location
        ? window.location.pathname
        : "/";

    // Check page targeting rules
    if (!isPageAllowed(data.config, currentPath)) {
      return;
    }

    // Filter matching testimonials and reviews
    const currentLocation =
      typeof window !== "undefined" ? window.location : { pathname: "/" };

    const matchingTestimonials = filterTestimonials(
      data.testimonials || [],
      currentLocation
    );

    const rawReviews = Array.isArray(data.reviews) ? data.reviews : [];
    const matchingReviews = filterReviews(rawReviews, currentLocation);

    if (matchingTestimonials.length === 0 && matchingReviews.length === 0) {
      return;
    }

    // Initialize analytics tracker
    const analytics = new AnalyticsTracker({
      spaceId: data.spaceId,
      apiBase,
      conversionGoals: data.conversionGoals,
      experimentId: activeExperimentId,
      variantIndex: activeVariantIndex,
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
      reviews: matchingReviews,
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
