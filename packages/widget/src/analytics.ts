import { matchPattern } from "./matcher";

export type EventType = "impression" | "play" | "click" | "convert";

export interface AnalyticsEvent {
  spaceId: string;
  testimonialId?: string | null;
  sessionId: string;
  eventType: EventType;
  pageUrl: string;
  timestamp: string;
  metadata?: Record<string, unknown> | null;
}

export interface ConversionGoal {
  id: string;
  goalType: string;
  goalValue: string;
}

export interface AnalyticsConfig {
  spaceId: string;
  apiBase: string;
  conversionGoals?: ConversionGoal[];
  flushIntervalMs?: number;
}

/**
 * Generates a compliant v4-like unique identifier for anonymous session tracking.
 */
export function generateSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }

  // RFC4122 v4 UUID generator fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieves existing session ID from sessionStorage or generates and persists a new one.
 */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return generateSessionId();
  }

  const STORAGE_KEY = "vouchreel_session_id";
  try {
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 10) {
      return existing;
    }
    const newId = generateSessionId();
    window.sessionStorage.setItem(STORAGE_KEY, newId);
    return newId;
  } catch {
    return generateSessionId();
  }
}

export class AnalyticsTracker {
  private spaceId: string;
  private apiBase: string;
  private sessionId: string;
  private conversionGoals: ConversionGoal[];
  private queue: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushIntervalMs: number;
  private isDestroyed = false;

  constructor(config: AnalyticsConfig) {
    this.spaceId = config.spaceId;
    this.apiBase = config.apiBase ? config.apiBase.replace(/\/+$/, "") : "";
    this.sessionId = getOrCreateSessionId();
    this.conversionGoals = config.conversionGoals || [];
    this.flushIntervalMs = config.flushIntervalMs ?? 5000;

    this.bindLifecycleListeners();
    this.checkConversionGoals();
  }

  /**
   * Tracks an analytics event and queues it for batched delivery.
   */
  public track(
    eventType: EventType,
    testimonialId?: string | null,
    metadata?: Record<string, unknown> | null
  ): void {
    if (this.isDestroyed || !this.spaceId) return;

    const pageUrl =
      typeof window !== "undefined" && window.location
        ? window.location.href.split("#")[0]
        : "";

    const event: AnalyticsEvent = {
      spaceId: this.spaceId,
      testimonialId: testimonialId || null,
      sessionId: this.sessionId,
      eventType,
      pageUrl,
      timestamp: new Date().toISOString(),
      metadata: metadata || null,
    };

    this.queue.push(event);

    // If widget impression occurred, store flag in sessionStorage for conversion attribution
    if (eventType === "impression" || eventType === "play") {
      try {
        window.sessionStorage.setItem("vouchreel_engaged", "true");
      } catch {
        // ignore
      }
    }

    this.scheduleFlush();
  }

  /**
   * Checks if current page URL satisfies any conversion goals.
   */
  public checkConversionGoals(): void {
    if (
      typeof window === "undefined" ||
      !window.location ||
      !this.conversionGoals ||
      this.conversionGoals.length === 0
    ) {
      return;
    }

    const currentPath = window.location.pathname;

    for (const goal of this.conversionGoals) {
      if (goal.goalType === "url-match" && goal.goalValue) {
        if (matchPattern(goal.goalValue, currentPath)) {
          // Check if this conversion goal was already tracked in this session
          const convertedKey = `vouchreel_converted_${goal.id}`;
          try {
            if (window.sessionStorage.getItem(convertedKey) === "true") {
              continue;
            }
            window.sessionStorage.setItem(convertedKey, "true");
          } catch {
            // continue
          }

          this.track("convert", null, { goalId: goal.id, goalValue: goal.goalValue });
        }
      }
    }
  }

  /**
   * Immediately flushes queued events to the server.
   */
  public flush(): void {
    if (this.queue.length === 0) return;

    if (this.flushTimer !== null) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const batch = [...this.queue];
    this.queue = [];

    const endpoint = `${this.apiBase}/api/events`;
    const payload = JSON.stringify({ events: batch });

    // Use navigator.sendBeacon when available for reliable background transmission
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([payload], { type: "application/json" });
        const queued = navigator.sendBeacon(endpoint, blob);
        if (queued) return;
      } catch {
        // fallback to fetch
      }
    }

    // Fallback to fetch with keepalive
    if (typeof fetch === "function") {
      try {
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {
          // Silently handle offline/network errors
        });
      } catch {
        // Silently handle
      }
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, this.flushIntervalMs);
  }

  private bindLifecycleListeners(): void {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        this.flush();
      }
    };

    const handlePageHide = () => {
      this.flush();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.flush();
  }
}
