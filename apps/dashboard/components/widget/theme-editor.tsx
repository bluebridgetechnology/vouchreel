"use client";

import { WidgetTheme } from "@/lib/validations/widget-config";
import { DEFAULT_BRAND_HEX } from "@/lib/brand";
import { ACCENT_COLOR_PRESETS, PRIMARY_COLOR_PRESETS } from "@/lib/widget-presets";
import { cn } from "@/lib/utils";
import { inputClass } from "@/components/ui/input";
import { toggleStyle } from "@/components/ui/toggle";

interface ThemeEditorProps {
  value: WidgetTheme;
  onChange: (theme: WidgetTheme) => void;
}

const RADIUS_PRESETS = [
  { label: "Sharp (0px)", value: 0 },
  { label: "Subtle (6px)", value: 6 },
  { label: "Standard (12px)", value: 12 },
  { label: "Rounded (18px)", value: 18 },
  { label: "Pill (24px)", value: 24 },
];

export function ThemeEditor({ value, onChange }: ThemeEditorProps) {
  function handlePrimaryChange(hex: string) {
    onChange({
      ...value,
      primaryColor: hex,
    });
  }

  function handleAccentChange(hex: string) {
    onChange({
      ...value,
      accentColor: hex,
    });
  }

  function handleModeChange(mode: "light" | "dark") {
    onChange({
      ...value,
      mode,
    });
  }

  function handleRadiusChange(radius: number) {
    onChange({
      ...value,
      borderRadius: radius,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-foreground">Theme & Branding</h3>
        <p className="text-xs text-muted-foreground">
          Customize colors, light/dark mode, and shape to match your brand identity.
        </p>
      </div>

      <div className="space-y-5 rounded-card border bg-card p-4 sm:p-5">
        {/* Colors Row */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Primary Color */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="widget-primary-hex"
                className="text-xs font-medium text-foreground"
              >
                Primary Brand Color
              </label>
              <span className="font-mono text-2xs text-muted-foreground">
                {value.primaryColor}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-control border shadow-sm">
                <input
                  type="color"
                  value={value.primaryColor}
                  onChange={(e) => handlePrimaryChange(e.target.value)}
                  aria-label="Primary brand color picker"
                  className="absolute -inset-2 h-14 w-14 cursor-pointer border-0 p-0"
                />
              </div>
              <input
                id="widget-primary-hex"
                type="text"
                value={value.primaryColor}
                onChange={(e) => handlePrimaryChange(e.target.value)}
                placeholder={DEFAULT_BRAND_HEX}
                className={cn(inputClass, "w-full font-mono text-xs")}
              />
            </div>

            {/* Quick Swatches */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {PRIMARY_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  title={preset.name}
                  onClick={() => handlePrimaryChange(preset.hex)}
                  className={cn("h-5 w-5 rounded-pill border transition-transform", toggleStyle("swatch", value.primaryColor.toLowerCase() === preset.hex.toLowerCase()))}
                  style={{ backgroundColor: preset.hex }}
                />
              ))}
            </div>
          </div>

          {/* Accent Color */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="widget-accent-hex"
                className="text-xs font-medium text-foreground"
              >
                Accent / Text Color
              </label>
              <span className="font-mono text-2xs text-muted-foreground">
                {value.accentColor}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-control border shadow-sm">
                <input
                  type="color"
                  value={value.accentColor}
                  onChange={(e) => handleAccentChange(e.target.value)}
                  aria-label="Accent text color picker"
                  className="absolute -inset-2 h-14 w-14 cursor-pointer border-0 p-0"
                />
              </div>
              <input
                id="widget-accent-hex"
                type="text"
                value={value.accentColor}
                onChange={(e) => handleAccentChange(e.target.value)}
                placeholder={ACCENT_COLOR_PRESETS[0].hex}
                className={cn(inputClass, "w-full font-mono text-xs")}
              />
            </div>

            {/* Quick Swatches */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {ACCENT_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.hex}
                  type="button"
                  title={preset.name}
                  onClick={() => handleAccentChange(preset.hex)}
                  className={cn("h-5 w-5 rounded-pill border transition-transform", toggleStyle("swatch", value.accentColor.toLowerCase() === preset.hex.toLowerCase()))}
                  style={{ backgroundColor: preset.hex }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Mode & Radius Row */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* Light / Dark Mode Toggle */}
          <div className="space-y-2">
            <span id="display-mode-label" className="text-xs font-medium text-foreground">
              Display Mode
            </span>
            <div role="group" aria-labelledby="display-mode-label" className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleModeChange("light")}
                className={cn("flex items-center justify-center gap-2 rounded-card border py-2 text-xs font-medium transition-all", toggleStyle("choice", value.mode === "light"))}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Light Mode
              </button>

              <button
                type="button"
                onClick={() => handleModeChange("dark")}
                className={cn("flex items-center justify-center gap-2 rounded-card border py-2 text-xs font-medium transition-all", toggleStyle("choice", value.mode === "dark"))}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                Dark Mode
              </button>
            </div>
            <p className="text-2xs text-muted-foreground">
              Controls card surfaces, backgrounds, and contrast inside video modals.
            </p>
          </div>

          {/* Border Radius Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="widget-border-radius"
                className="text-xs font-medium text-foreground"
              >
                Corner Radius
              </label>
              <span className="rounded-control bg-muted px-2 py-0.5 font-mono text-2xs font-medium text-foreground">
                {value.borderRadius}px
              </span>
            </div>

            <div className="space-y-3 pt-1">
              <input
                id="widget-border-radius"
                type="range"
                min={0}
                max={24}
                step={1}
                value={value.borderRadius}
                onChange={(e) => handleRadiusChange(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />

              <div className="flex flex-wrap gap-1.5">
                {RADIUS_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleRadiusChange(preset.value)}
                    className={cn("rounded-control border px-2 py-0.5 text-2xs font-medium transition-colors", toggleStyle("solid", value.borderRadius === preset.value))}
                  >
                    {preset.value}px
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
