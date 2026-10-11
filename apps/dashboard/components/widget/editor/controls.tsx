"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { toggleStyle } from "@/components/ui/toggle";
import { Switch } from "@/components/ui/switch";

/** Compact controls for the widget editor's side panel. Each one is labelled for screen readers. */

export function ControlRow({ label, hint, children, htmlFor }: { label: string; hint?: React.ReactNode; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-text">
        {label}
      </label>
      {children}
      {hint && <p className="text-2xs text-text-muted">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <span id={id} className="block text-xs font-medium text-text">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="flex rounded-control bg-surface-sunken p-0.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn("flex-1 rounded-control px-2 py-1.5 text-xs font-medium transition-colors", toggleStyle("raised", value === o.value))}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SliderControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-text">
          {label}
        </label>
        <span className="font-mono text-2xs text-text-muted tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full cursor-pointer accent-primary" />
    </div>
  );
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * A colour: swatch picker plus hex field. With `onClear`, the colour is optional and "Auto" (null) means
 * "follow light/dark mode". The hex field only reports valid colours, so typing never produces a bad value.
 */
export function ColorControl({
  label,
  value,
  fallback,
  onChange,
  onClear,
  swatches,
}: {
  label: string;
  value: string | null;
  /** Shown in the picker while the value is Auto. */
  fallback: string;
  onChange: (hex: string) => void;
  onClear?: () => void;
  swatches?: readonly { name: string; hex: string }[];
}) {
  const id = useId();
  const shown = value ?? fallback;
  const field = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value ?? "");
  // Follow changes made elsewhere (picker, swatch, undo), but never rewrite what the owner is typing
  useEffect(() => {
    if (document.activeElement !== field.current) setText(value ?? "");
  }, [value]);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-text">
          {label}
        </label>
        {onClear &&
          (value === null ? (
            <span className="text-2xs text-text-muted">Auto</span>
          ) : (
            <button type="button" onClick={onClear} className={cn(buttonVariants({ variant: "link", size: "bare" }), "text-2xs font-medium")}>
              Reset to auto
            </button>
          ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="relative size-9 shrink-0 overflow-hidden rounded-control border shadow-xs">
          <input type="color" value={shown.length === 4 ? expand(shown) : shown} onChange={(e) => onChange(e.target.value)} aria-label={`${label} picker`} className="absolute -inset-2 size-14 cursor-pointer border-0 p-0" />
        </span>
        <input
          id={id}
          ref={field}
          type="text"
          value={text}
          placeholder={value === null ? "Auto" : fallback}
          spellCheck={false}
          onChange={(e) => {
            setText(e.target.value);
            if (HEX.test(e.target.value.trim())) onChange(e.target.value.trim());
          }}
          onBlur={() => setText(value ?? "")}
          className={cn(inputClass, "h-9 w-full font-mono text-xs")}
        />
      </div>
      {swatches && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {swatches.map((s) => (
            <button
              key={s.hex}
              type="button"
              title={s.name}
              aria-label={s.name}
              onClick={() => onChange(s.hex)}
              className={cn("size-5 rounded-pill border transition-transform", toggleStyle("swatch", shown.toLowerCase() === s.hex.toLowerCase()))}
              style={{ backgroundColor: s.hex }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const expand = (hex: string) => `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;

export function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-xs font-medium text-text">
          {label}
        </label>
        {hint && <p className="text-2xs text-text-muted">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** A line of code the owner pastes into their site, with a Copy button. */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium text-text">{label}</span>
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-control bg-surface-sunken px-3 py-2 font-mono text-2xs text-text">{value}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-auto shrink-0 px-3 text-text-muted")}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
