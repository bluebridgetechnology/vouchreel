"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
    {
      label: "Testimonials",
      href: `/spaces/${spaceId}/testimonials`,
      active: pathname.startsWith(`/spaces/${spaceId}/testimonials`),
    },
    {
      label: "Reviews",
      href: `/spaces/${spaceId}/reviews`,
      active: pathname.startsWith(`/spaces/${spaceId}/reviews`),
    },
    {
      label: "Collect",
      href: `/spaces/${spaceId}/collect`,
      active: pathname.startsWith(`/spaces/${spaceId}/collect`),
      badge: pendingCount,
    },
    {
      label: "Widget",
      href: `/spaces/${spaceId}/widget`,
      active: pathname.startsWith(`/spaces/${spaceId}/widget`),
    },
    {
      label: "Analytics",
      href: `/spaces/${spaceId}/analytics`,
      active: pathname.startsWith(`/spaces/${spaceId}/analytics`),
    },
  ];

  function copyEmbedKey() {
    navigator.clipboard.writeText(embedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/spaces"
              className="text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Spaces
            </Link>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs font-medium text-foreground">{spaceName}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{spaceName}</h1>
        </div>

        {/* Embed Key copy badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Embed Key:</span>
          <button
            onClick={copyEmbedKey}
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 font-mono text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
            title="Click to copy embed key"
          >
            <span>{embedKey}</span>
            {copied ? (
              <span className="text-[11px] font-semibold text-green-700">Copied!</span>
            ) : (
              <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Sub-navigation tabs */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${
                tab.active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.badge !== null && tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {tab.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
