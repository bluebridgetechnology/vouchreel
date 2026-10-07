"use client";

import { useEffect } from "react";
import { VIDEO_FONTS, type VideoFontId } from "@vouchreel/video";
import { ensureVideoFontFaces } from "@vouchreel/video/font-faces";
import { toggleStyle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

export interface VideoFontPickerProps {
  /** null = the default option (no explicit choice). */
  value: VideoFontId | null;
  onChange: (value: VideoFontId | null) => void;
  /** When set, a first option meaning "no explicit choice" is shown with this title and hint. */
  defaultOption?: { title: string; hint: string };
  /** Accessible name for the group. */
  label: string;
}

/**
 * Font choices for review videos, each drawn in its own font (the same files the render uses), so what
 * the customer sees here is the type that ends up in the video.
 */
export function VideoFontPicker({ value, onChange, defaultOption, label }: VideoFontPickerProps) {
  useEffect(() => ensureVideoFontFaces("/video-fonts"), []);

  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {defaultOption && (
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          onClick={() => onChange(null)}
          className={cn("rounded-card border p-1.5 text-left transition-all", toggleStyle("choice", value === null))}
        >
          <span className="flex h-16 items-center justify-center rounded-control border border-dashed px-2 text-center text-2xs text-text-muted">{defaultOption.hint}</span>
          <span className="mt-1.5 block px-1 text-xs font-medium">{defaultOption.title}</span>
        </button>
      )}
      {VIDEO_FONTS.map((font) => (
        <button
          key={font.id}
          type="button"
          role="radio"
          aria-checked={value === font.id}
          onClick={() => onChange(font.id)}
          className={cn("rounded-card border p-1.5 text-left transition-all", toggleStyle("choice", value === font.id))}
        >
          <span className="flex h-16 items-center justify-center rounded-control bg-surface-sunken text-3xl font-medium" style={{ fontFamily: `'${font.family}', sans-serif` }} aria-hidden>
            Aa
          </span>
          <span className="mt-1.5 block px-1 text-xs font-medium">{font.label}</span>
          <span className="block px-1 text-2xs text-text-muted">{font.kind}</span>
        </button>
      ))}
    </div>
  );
}
