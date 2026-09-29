export type TriggerType =
  | "delay"
  | "exit-intent"
  | "scroll-depth"
  | "pageview-count"
  | "returning-visitor";

export interface TriggerOptions {
  type: TriggerType;
  value?: {
    seconds?: number;
    percentage?: number;
    count?: number;
    [key: string]: unknown;
  } | null;
  embedKey: string;
  onTrigger: () => void;
}

export interface TriggerController {
  cancel: () => void;
}

/**
 * Checks if the widget was dismissed during this browser session.
 */
export function isDismissed(embedKey: string): boolean {
  if (typeof window === "undefined" || !window.sessionStorage) return false;
  try {
    return (
      window.sessionStorage.getItem(`vouchreel_dismissed_${embedKey}`) === "true"
    );
  } catch {
    return false;
  }
}

/**
 * Marks the widget as dismissed in sessionStorage so it will not re-trigger in this session.
 */
export function markDismissed(embedKey: string): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(`vouchreel_dismissed_${embedKey}`, "true");
  } catch {
    // Storage access might be restricted in some iframe contexts
  }
}

/**
 * Detects if the current device is mobile based on userAgent or maxTouchPoints.
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return (
    navigator.maxTouchPoints > 0 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    )
  );
}

/**
 * Sets up and activates the configured trigger.
 * Returns a TriggerController with a cancel() method.
 */
export function setupTrigger({
  type,
  value,
  embedKey,
  onTrigger,
}: TriggerOptions): TriggerController {
  // If dismissed earlier in this session, do not trigger
  if (isDismissed(embedKey)) {
    return { cancel: () => {} };
  }

  let triggered = false;
  const fire = () => {
    if (triggered) return;
    if (isDismissed(embedKey)) return;
    triggered = true;
    cleanup();
    onTrigger();
  };

  let timerId: ReturnType<typeof setTimeout> | null = null;
  let observer: IntersectionObserver | null = null;
  let sentinelEl: HTMLElement | null = null;
  let cleanups: Array<() => void> = [];

  const cleanup = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (sentinelEl && sentinelEl.parentNode) {
      sentinelEl.parentNode.removeChild(sentinelEl);
      sentinelEl = null;
    }
    for (const fn of cleanups) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
    cleanups = [];
  };

  switch (type) {
    case "delay": {
      const seconds =
        value && typeof value.seconds === "number" && value.seconds > 0
          ? value.seconds
          : 3;
      timerId = setTimeout(fire, seconds * 1000);
      break;
    }

    case "exit-intent": {
      if (typeof window === "undefined" || typeof document === "undefined") break;

      const isMobile = isMobileDevice();

      if (!isMobile) {
        // Desktop: trigger when mouse leaves top edge of viewport
        const handleMouseLeave = (e: MouseEvent) => {
          if (e.clientY <= 0 || !e.relatedTarget) {
            fire();
          }
        };

        document.addEventListener("mouseleave", handleMouseLeave);
        cleanups.push(() =>
          document.removeEventListener("mouseleave", handleMouseLeave)
        );
      } else {
        // Mobile: detect rapid scroll-up gesture after scrolling down
        let lastScrollY = window.scrollY || window.pageYOffset;
        let lastTimestamp = Date.now();

        const handleScroll = () => {
          const currentScrollY = window.scrollY || window.pageYOffset;
          const currentTimestamp = Date.now();
          const deltaY = currentScrollY - lastScrollY;
          const deltaTime = currentTimestamp - lastTimestamp;

          // User scrolled down at least 150px and then flicked up (> 40px in < 150ms)
          if (
            currentScrollY > 150 &&
            deltaY < -40 &&
            deltaTime > 0 &&
            deltaTime < 200
          ) {
            fire();
          }

          lastScrollY = currentScrollY;
          lastTimestamp = currentTimestamp;
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        cleanups.push(() =>
          window.removeEventListener("scroll", handleScroll)
        );
      }
      break;
    }

    case "scroll-depth": {
      if (typeof window === "undefined" || typeof document === "undefined") break;

      const pct =
        value && typeof value.percentage === "number" && value.percentage > 0
          ? Math.min(Math.max(value.percentage, 1), 100)
          : 50;

      // Check if IntersectionObserver is supported
      if (typeof IntersectionObserver !== "undefined" && document.body) {
        try {
          sentinelEl = document.createElement("div");
          sentinelEl.className = "vouchreel-scroll-sentinel";
          sentinelEl.style.position = "absolute";
          sentinelEl.style.top = `${pct}%`;
          sentinelEl.style.left = "0";
          sentinelEl.style.width = "1px";
          sentinelEl.style.height = "1px";
          sentinelEl.style.pointerEvents = "none";
          sentinelEl.style.opacity = "0";
          sentinelEl.style.zIndex = "-1";
          document.body.appendChild(sentinelEl);

          observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                fire();
                break;
              }
            }
          });

          observer.observe(sentinelEl);
        } catch {
          // fallback to scroll listener
        }
      }

      // Fallback or auxiliary scroll listener
      const handleDepthScroll = () => {
        const scrollTop =
          window.scrollY ||
          document.documentElement.scrollTop ||
          document.body.scrollTop ||
          0;
        const scrollHeight =
          document.documentElement.scrollHeight || document.body.scrollHeight || 1;
        const clientHeight =
          window.innerHeight || document.documentElement.clientHeight || 1;

        const maxScroll = scrollHeight - clientHeight;
        if (maxScroll <= 0) {
          // Content fits in single screen, trigger after small delay
          timerId = setTimeout(fire, 1500);
          return;
        }

        const currentPct = (scrollTop / maxScroll) * 100;
        if (currentPct >= pct) {
          fire();
        }
      };

      window.addEventListener("scroll", handleDepthScroll, { passive: true });
      cleanups.push(() =>
        window.removeEventListener("scroll", handleDepthScroll)
      );

      // Initial check in case user is already scrolled
      handleDepthScroll();
      break;
    }

    case "pageview-count": {
      if (typeof window === "undefined" || !window.sessionStorage) {
        fire();
        break;
      }

      const targetCount =
        value && typeof value.count === "number" && value.count > 0
          ? value.count
          : 2;

      let currentCount = 1;
      try {
        const stored = window.sessionStorage.getItem("vouchreel_pv_count");
        currentCount = stored ? parseInt(stored, 10) + 1 : 1;
        window.sessionStorage.setItem("vouchreel_pv_count", currentCount.toString());
      } catch {
        // Ignore storage errors
      }

      if (currentCount >= targetCount) {
        // Trigger on reaching target count (with a brief delay for page settle)
        timerId = setTimeout(fire, 800);
      }
      break;
    }

    case "returning-visitor": {
      if (typeof window === "undefined" || !window.localStorage) {
        fire();
        break;
      }

      try {
        const hasVisited = window.localStorage.getItem("vouchreel_visited") === "true";
        if (hasVisited) {
          // Returning visitor! Trigger after slight delay
          timerId = setTimeout(fire, 1000);
        } else {
          // First visit: record flag for next visit
          window.localStorage.setItem("vouchreel_visited", "true");
        }
      } catch {
        // If storage blocked, fire as fallback
        timerId = setTimeout(fire, 2000);
      }
      break;
    }

    default: {
      timerId = setTimeout(fire, 3000);
      break;
    }
  }

  return {
    cancel: cleanup,
  };
}
