"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ANNOUNCEMENT_LINK_TEXT_DEFAULT, isInternalLink } from "@/lib/validations/announcement";

/** The browser storage key holding the announcement a visitor last closed. */
const DISMISSED_KEY = "vouchreel:announcement-dismissed";

interface AnnouncementBarProps {
  /** Changes whenever the announcement does, so closing one does not hide the next. */
  id: string;
  message: string;
  linkText?: string;
  linkUrl?: string;
  /** The admin form's preview: no close button, and it never reads or writes the visitor's storage. */
  preview?: boolean;
}

/**
 * The announcement bar across the top of the marketing pages: one line, an optional link, and a close button that
 * remembers (in this browser only) that this announcement was closed. Written by an admin in Admin > Announcement.
 */
export function AnnouncementBar({ id, message, linkText, linkUrl, preview = false }: AnnouncementBarProps) {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (preview) return;
    try {
      setClosed(localStorage.getItem(DISMISSED_KEY) === id);
    } catch {
      // Storage can be blocked; the bar then shows each visit, which is harmless
    }
  }, [id, preview]);

  if (closed) return null;

  const text = linkText || ANNOUNCEMENT_LINK_TEXT_DEFAULT;
  const linkClass = "inline-flex items-center gap-1 font-medium underline underline-offset-4 hover:opacity-80";

  function close() {
    setClosed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, id);
    } catch {
      // Not remembered, but closed for now
    }
  }

  return (
    <div role="region" aria-label="Announcement" className="relative bg-surface-inverse text-text-inverse">
      <div className="mx-auto flex max-w-(--container-page) flex-wrap items-center justify-center gap-x-3 gap-y-1 px-12 py-2.5 text-center text-sm">
        <p>{message}</p>
        {linkUrl &&
          (isInternalLink(linkUrl) ? (
            <Link href={linkUrl} className={linkClass}>
              {text} <Icon name="arrow-right" size="sm" />
            </Link>
          ) : (
            <a href={linkUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
              {text} <Icon name="arrow-right" size="sm" />
            </a>
          ))}
      </div>
      {!preview && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Close announcement"
          onClick={close}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-inverse hover:bg-text-inverse/10 hover:text-text-inverse"
        >
          <Icon name="close" size="sm" />
        </Button>
      )}
    </div>
  );
}
