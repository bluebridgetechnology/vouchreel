"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface SpaceNavTabsProps {
  spaceId: string;
  spaceName: string;
  embedKey: string;
}

export function SpaceNavTabs({
  spaceId,
  spaceName,
  embedKey,
}: SpaceNavTabsProps) {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(`/api/spaces/${spaceId}/collection-forms`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.collectionForms) setPendingCount(data.collectionForms.reduce((total: number, form: { pendingSubmissionCount?: number }) => total + Number(form.pendingSubmissionCount || 0), 0));
      })
      .catch(() => undefined);
  }, [spaceId]);

  const tabs = [
    { label: "Testimonials", segment: "testimonials" },
    { label: "Reviews", segment: "reviews" },
    { label: "Collect", segment: "collect", badge: pendingCount },
    { label: "Social", segment: "social" },
    { label: "Brand", segment: "brand" },
    { label: "Widget", segment: "widget" },
    { label: "Experiments", segment: "experiments" },
    { label: "Analytics", segment: "analytics" },
  ].map((tab) => ({
    ...tab,
    href: `/spaces/${spaceId}/${tab.segment}`,
    active: pathname.startsWith(`/spaces/${spaceId}/${tab.segment}`),
  }));

  function copyEmbedKey() {
    navigator.clipboard.writeText(embedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-text-muted">
            <Link href="/spaces" className="inline-flex items-center gap-1 hover:text-text">
              <Icon name="arrow-left" size="sm" /> Spaces
            </Link>
          </nav>
          <h1 className="break-words text-2xl font-medium sm:text-3xl">{spaceName}</h1>
        </div>

        <button
          type="button"
          onClick={copyEmbedKey}
          title="Click to copy embed key"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "max-w-full self-start sm:self-auto")}
        >
          <span className="shrink-0 text-text-muted">Embed key</span>
          <span className="min-w-0 truncate font-mono">{embedKey}</span>
          {copied ? (
            <span className="shrink-0 text-success-foreground">Copied</span>
          ) : (
            <Icon name="copy" size="sm" className="text-text-subtle" />
          )}
        </button>
      </div>

      {/* Scrolls horizontally on small screens instead of widening the page */}
      <nav
        aria-label="Space sections"
        className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        <div className="inline-flex min-w-max items-center gap-1 rounded-pill bg-surface-sunken p-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-pill px-4 text-sm font-medium transition-colors",
                tab.active
                  ? "bg-surface text-text shadow-sm"
                  : "text-text-muted hover:text-text",
              )}
            >
              {tab.label}
              {tab.badge !== null && tab.badge !== undefined && tab.badge > 0 && (
                <span className="rounded-pill bg-brand px-1.5 text-2xs font-medium text-text-on-accent">
                  {tab.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
