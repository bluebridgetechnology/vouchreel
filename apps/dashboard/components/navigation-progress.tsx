"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin top progress bar for client-side navigation. The App Router has no router
 * events, so it starts on a click of an internal link and finishes when the pathname
 * changes (with a safety timeout so it can never stick).
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const active = useRef(false);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (trickle.current) clearInterval(trickle.current);
    trickle.current = null;
  };

  const start = () => {
    if (active.current) return;
    active.current = true;
    clear();
    setVisible(true);
    setWidth(8);
    trickle.current = setInterval(() => setWidth((w) => (w < 85 ? w + (90 - w) * 0.12 : w)), 250);
    timers.current.push(setTimeout(() => finish(), 12_000));
  };

  const finish = () => {
    if (!active.current) return;
    active.current = false;
    clear();
    setWidth(100);
    timers.current.push(setTimeout(() => setVisible(false), 250));
    timers.current.push(setTimeout(() => setWidth(0), 500));
  };

  // Route changed: complete the bar
  useEffect(() => {
    finish();
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clear();
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-(--z-toast) h-0.5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms" }}
    >
      <div
        className="h-full bg-brand shadow-[0_0_8px_var(--ring-soft)]"
        style={{ width: `${width}%`, transition: width === 0 ? "none" : "width 250ms ease-out" }}
      />
    </div>
  );
}
