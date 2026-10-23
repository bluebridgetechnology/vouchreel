"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

/** The browser storage key that remembers the notice was read. */
const SEEN_KEY = "vouchreel:cookie-notice-seen";

/**
 * Pages a customer's own visitors land on (the testimonial form, the shared wall, the widget frames, the consent page):
 * they belong to the business that sent the link, so Vouchreel's own notice stays off them.
 */
const SKIP_PREFIXES = ["/collect", "/wall", "/widget", "/consent"];

/**
 * A short notice that Vouchreel sets cookies, shown once per browser. The only cookies are the ones the site needs to
 * work (staying signed in, remembering the sidebar and a short-lived one while connecting Google reviews), so this
 * informs and has one button; there is no advertising or tracking to switch off. The privacy policy says the same.
 */
export function CookieNotice() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(SEEN_KEY) !== "1");
    } catch {
      // Storage blocked: show it, and it will show again next visit
      setVisible(true);
    }
  }, []);

  if (!visible || SKIP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Not remembered, but closed for now
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-toast) p-4 sm:p-6">
      <Card
        role="region"
        aria-label="Cookie notice"
        className="pointer-events-auto flex max-w-md flex-col gap-4 p-5 shadow-float sm:flex-row sm:items-end"
      >
        <div className="flex gap-3">
          <Icon name="info-circle" className="mt-0.5 shrink-0 text-brand" />
          <p className="text-sm text-text-muted">
            We use a few essential cookies to keep you signed in and remember your settings. No advertising or tracking cookies.{" "}
            <Link href="/privacy#cookies" className="text-text underline underline-offset-4 hover:opacity-80">
              Read more
            </Link>
          </p>
        </div>
        <Button type="button" size="sm" onClick={dismiss} className="shrink-0">
          Got it
        </Button>
      </Card>
    </div>
  );
}
