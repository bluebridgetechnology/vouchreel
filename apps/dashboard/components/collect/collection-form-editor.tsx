"use client";

import { DEFAULT_BRAND_HEX, readableOn } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toggleStyle } from "@/components/ui/toggle";
import { COLLECT_MODES, type CollectMode } from "@/lib/collect/modes";
import { cn } from "@/lib/utils";

export type CollectionDraft = {
  title: string;
  promptText: string;
  incentiveType: "none" | "discount" | "custom";
  incentiveValue: string;
  accentColor: string;
  collectModes: CollectMode;
  isActive: boolean;
};

const INCENTIVES = [
  { value: "none", label: "None" },
  { value: "discount", label: "Discount" },
  { value: "custom", label: "Custom" },
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Black or white, whichever reads on the colour (for the preview button only) */
function textOn(hex: string) {
  return readableOn(HEX.test(hex) ? hex : DEFAULT_BRAND_HEX);
}

/** Segmented choice on a soft track: one outline for the group instead of one box per option */
function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="space-y-1.5">
      <Label id={`seg-${label}`}>{label}</Label>
      <div role="radiogroup" aria-labelledby={`seg-${label}`} className="flex gap-1 rounded-control bg-surface-sunken p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn("flex-1 rounded-control px-3 py-1.5 text-sm font-medium transition-colors", toggleStyle("raised", value === o.value))}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  draft: CollectionDraft;
  editing: boolean;
  onChange: (key: keyof CollectionDraft, value: string | boolean) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

export function CollectionFormEditor({ draft, editing, onChange, onSubmit, onCancel }: Props) {
  const accentOk = HEX.test(draft.accentColor);
  const accent = accentOk ? draft.accentColor : DEFAULT_BRAND_HEX;
  // Short labels fit three across; the full wording stays in the form list below
  const SHORT: Record<CollectMode, string> = { both: "Video or written", video: "Video only", text: "Written only" };
  const modeOptions = COLLECT_MODES.map((m) => ({ value: m, label: SHORT[m] }));

  return (
    <Card as="form" onSubmit={onSubmit} className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">{editing ? "Edit collection form" : "New collection form"}</h3>
          <p className="text-sm text-text-muted">What customers see when they open your link.</p>
        </div>

        <Field label="Headline" htmlFor="cf-title" hint="Shown at the top of the page.">
          <Input id="cf-title" required value={draft.title} onChange={(e) => onChange("title", e.target.value)} placeholder="Tell us how we did" maxLength={120} />
        </Field>

        <Field label="Message to your customer" htmlFor="cf-prompt" hint="Say what you would like them to talk about. A few specific questions get better answers.">
          <Textarea id="cf-prompt" required value={draft.promptText} onChange={(e) => onChange("promptText", e.target.value)} placeholder="What problem were you trying to solve, and how has it gone since?" rows={4} maxLength={1000} />
        </Field>

        <Segmented label="Ask for" value={draft.collectModes} options={modeOptions} onChange={(v) => onChange("collectModes", v)} />

        <div className="space-y-3">
          <Segmented label="Thank-you gift" value={draft.incentiveType} options={INCENTIVES} onChange={(v) => onChange("incentiveType", v)} />
          {draft.incentiveType !== "none" && (
            <Field label={draft.incentiveType === "discount" ? "Discount offered" : "What they get"} htmlFor="cf-incentive" hint="Shown to the customer before they submit.">
              <Input id="cf-incentive" required value={draft.incentiveValue} onChange={(e) => onChange("incentiveValue", e.target.value)} placeholder={draft.incentiveType === "discount" ? "20% off your next order" : "A free month"} maxLength={200} />
            </Field>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cf-accent">Accent colour</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              aria-label="Pick accent colour"
              value={accent}
              onChange={(e) => onChange("accentColor", e.target.value)}
              className="size-10 shrink-0 cursor-pointer rounded-control border-0 bg-transparent p-0"
            />
            <Input id="cf-accent" required pattern="#[0-9a-fA-F]{6}" value={draft.accentColor} onChange={(e) => onChange("accentColor", e.target.value)} className="max-w-36 font-mono" aria-invalid={!accentOk} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-control bg-surface-sunken px-4 py-3">
          <div>
            <Label htmlFor="cf-active">Accept submissions</Label>
            <p className="text-xs text-text-muted">Turn off to close the form without deleting its link.</p>
          </div>
          <Switch id="cf-active" checked={draft.isActive} onCheckedChange={(v) => onChange("isActive", v)} />
        </div>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" size="md">
            {editing ? "Save changes" : "Create form"}
          </Button>
          {editing && (
            <Button type="button" variant="outline" size="md" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* What the customer will see, updating as you type */}
      <aside aria-label="Preview" className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">Preview</p>
        <div className="space-y-4 rounded-card bg-surface-sunken p-5">
          <h4 className="text-lg font-medium leading-snug">{draft.title || "Your headline"}</h4>
          <p className="whitespace-pre-wrap text-sm text-text-muted">{draft.promptText || "Your message to the customer."}</p>
          {draft.incentiveType !== "none" && draft.incentiveValue && <p className="rounded-control bg-surface p-3 text-sm font-medium">{draft.incentiveValue}</p>}
          <div className="flex flex-wrap gap-2">
            {draft.collectModes !== "text" && (
              <span className="rounded-control px-3 py-2 text-sm font-medium" style={{ background: accent, color: textOn(accent) }}>
                Record with camera
              </span>
            )}
            {draft.collectModes !== "video" && <span className="rounded-control bg-surface px-3 py-2 text-sm font-medium">Write instead</span>}
          </div>
          <p className="text-xs text-text-muted">Then: name and email.</p>
        </div>
      </aside>
    </Card>
  );
}
