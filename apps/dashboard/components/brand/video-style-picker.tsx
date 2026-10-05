"use client";

import { STYLES, derivePalette, swatchFor, type BackgroundStyle } from "@vouchreel/video";
import { DEFAULT_BRAND_HEX } from "@/lib/brand";
import { toggleStyle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

const HEX = /^#[0-9a-fA-F]{6}$/;

export interface VideoStylePickerProps {
  /** Brand colour the swatches are drawn in (invalid or partial input falls back to the default). */
  brand: string;
  /** Optional second colour (colour styles only). */
  secondary: string | null;
  /** null = the default option. */
  value: BackgroundStyle | null;
  onChange: (value: BackgroundStyle | null) => void;
  /** When set, a first option meaning "no explicit choice" is shown with this title and hint. */
  defaultOption?: { title: string; hint: string };
  /** Accessible name for the group. */
  label: string;
}

/**
 * Background style choices drawn from the real palette (the same code the renders use), so each swatch
 * shows the customer's colour and the text colour the video will actually use on it.
 */
export function VideoStylePicker({ brand, secondary, value, onChange, defaultOption, label }: VideoStylePickerProps) {
  const base = HEX.test(brand) ? brand : DEFAULT_BRAND_HEX;
  const second = secondary && HEX.test(secondary) ? secondary : undefined;

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
      {STYLES.map((style) => {
        const palette = derivePalette(base, { style: style.id, secondary: second });
        const swatch = swatchFor(palette, Boolean(second));
        return (
          <button
            key={style.id}
            type="button"
            role="radio"
            aria-checked={value === style.id}
            onClick={() => onChange(style.id)}
            title={style.description}
            className={cn("rounded-card border p-1.5 text-left transition-all", toggleStyle("choice", value === style.id))}
          >
            <span
              className="flex h-16 flex-col justify-center rounded-control px-3"
              style={{ background: swatch.background, backgroundSize: swatch.backgroundSize, color: swatch.color }}
              aria-hidden
            >
              <span className="text-lg font-medium leading-none">Aa</span>
              <span className="mt-1 text-2xs leading-none opacity-80">“Loved it.”</span>
            </span>
            <span className="mt-1.5 block px-1 text-xs font-medium">{style.label}</span>
          </button>
        );
      })}
    </div>
  );
}
