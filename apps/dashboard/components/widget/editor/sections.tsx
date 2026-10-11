"use client";

import { useId } from "react";
import type { UpdateWidgetConfigInput, WidgetTemplate, WidgetTheme } from "@/lib/validations/widget-config";
import { LAYOUTS, layoutInfo, type WidgetShape } from "@/lib/widget-editor/layouts";
import { contrastBetween, MIN_BUTTON_CONTRAST } from "@/lib/brand-kit/theme";
import { ACCENT_COLOR_PRESETS, PRIMARY_COLOR_PRESETS } from "@/lib/widget-presets";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { toggleStyle } from "@/components/ui/toggle";
import { Icon } from "@/components/ui/icon";
import { PositionPicker } from "../position-picker";
import { TriggerConfig } from "../trigger-config";
import { PageTargeting } from "../page-targeting";
import { EmbedSnippet } from "../embed-snippet";
import { InstallCheck } from "../install-check";
import { WallShare } from "../wall-share";
import { ColorControl, CopyField, Segmented, SliderControl, SwitchRow } from "./controls";
import { AUTO_BORDER_PREVIEW, WIDGET_MODE_COLOURS } from "@/lib/widget-editor/mode-colours";
import { applyPreset, matchingPreset, STYLE_PRESETS, type StylePreset } from "@/lib/widget-editor/presets";

type Theme = Required<WidgetTheme>;
type UpdateTheme = (patch: Partial<WidgetTheme>, key?: string) => void;

/** A numbered, collapsible step in the panel. */
export function EditorSection({
  step,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  step: number;
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section className="border-b last:border-b-0">
      <h3>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id} className={cn(buttonVariants({ variant: "ghost", size: "bare" }), "w-full justify-start gap-3 rounded-none px-4 py-3.5 text-left font-normal text-text")}>
          <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-pill text-2xs font-medium", open ? "bg-brand text-text-on-accent" : "bg-surface-sunken text-text-muted")}>{step}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-text">{title}</span>
            {!open && summary && <span className="block truncate text-2xs text-text-muted">{summary}</span>}
          </span>
          <Icon name={open ? "alt-arrow-up" : "alt-arrow-down"} size="sm" className="text-text-subtle" />
        </button>
      </h3>
      {open && (
        <div id={id} className="space-y-5 px-4 pb-5">
          {children}
        </div>
      )}
    </section>
  );
}

/** A small drawing of each layout, so the choice is visual rather than a list of names. */
export function LayoutSketch({ id }: { id: WidgetTemplate }) {
  const block = "rounded-[2px] bg-current";
  return (
    <span className="relative block h-10 w-14 shrink-0 overflow-hidden rounded-control border bg-surface text-brand" aria-hidden>
      {id === "floating-card" && <span className={cn(block, "absolute bottom-1 right-1 h-2.5 w-6")} />}
      {id === "floating-bubble" && <span className="absolute bottom-1 right-1 size-4 rounded-pill border-2 border-current bg-brand-soft" />}
      {id === "floating-reel" && <span className="absolute bottom-1 right-1 h-7 w-4 rounded-[3px] border-2 border-current bg-brand-soft" />}
      {id === "story-strip" && (
        <span className="absolute bottom-1 right-1 flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2 rounded-pill bg-current" />
          ))}
        </span>
      )}
      {id === "reel-feed" && (
        <span className="absolute inset-x-1 top-1.5 flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn(block, "h-7 w-3.5 shrink-0 opacity-80")} />
          ))}
        </span>
      )}
      {id === "spotlight" && (
        <span className="absolute inset-x-1.5 top-1.5 flex flex-col items-center gap-1">
          <span className={cn(block, "h-5 w-full opacity-80")} />
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 rounded-pill bg-current opacity-60" />
            ))}
          </span>
        </span>
      )}
      {id === "rating-badge" && (
        <span className="absolute inset-x-1.5 top-3.5 flex h-3 items-center gap-1 rounded-pill border-2 border-current px-1">
          <span className="h-1 w-3 rounded-pill bg-current" />
          <span className="h-1 w-2 rounded-pill bg-current opacity-50" />
        </span>
      )}
      {id === "marquee" && (
        <span className="absolute inset-x-0 top-3 flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn(block, "h-4 w-5 shrink-0", i === 0 || i === 3 ? "opacity-40" : "opacity-80")} />
          ))}
        </span>
      )}
      {id === "carousel" && (
        <span className="absolute inset-x-1 top-3 flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn(block, "h-4 w-4 shrink-0 opacity-80")} />
          ))}
        </span>
      )}
      {id === "wall-of-love" && (
        <span className="absolute inset-1 grid grid-cols-3 gap-0.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={cn(block, "opacity-80")} />
          ))}
        </span>
      )}
      {id === "masonry" && (
        <span className="absolute inset-1 grid grid-cols-3 gap-0.5">
          {["h-5", "h-3", "h-4"].map((h, i) => (
            <span key={i} className="flex flex-col gap-0.5">
              <span className={cn(block, h, "opacity-80")} />
              <span className={cn(block, "flex-1 opacity-50")} />
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

export function LayoutSection({ value, onChange }: { value: WidgetTemplate; onChange: (t: WidgetTemplate) => void }) {
  return (
    <div role="radiogroup" aria-label="Layout" className="space-y-2">
      {LAYOUTS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={value === l.id}
          onClick={() => onChange(l.id)}
          className={cn("flex w-full items-center gap-3 rounded-card border p-2.5 text-left transition-colors", toggleStyle("choice", value === l.id))}
        >
          <LayoutSketch id={l.id} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-sm font-medium text-text">{l.name}</span>
              <span className="rounded-pill bg-surface-sunken px-1.5 py-0.5 text-3xs font-medium uppercase tracking-wide text-text-muted">{l.placement}</span>
            </span>
            <span className="block text-2xs text-text-muted">{l.bestFor}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function BrandNote({ href }: { href?: string }) {
  return (
    <p role="note" className="rounded-card bg-brand-soft/40 p-3 text-2xs text-text-muted">
      <span className="font-medium text-text">Colours, corner radius and fonts come from your Brand settings.</span>{" "}
      {href && (
        <a href={href} className="font-medium text-text underline underline-offset-4 hover:text-brand">
          Edit brand
        </a>
      )}
    </p>
  );
}

function ContrastWarning({ a, b, what }: { a: string | null; b: string | null; what: string }) {
  if (!a || !b || contrastBetween(a, b) >= MIN_BUTTON_CONTRAST) return null;
  return (
    <p role="status" className="flex items-start gap-1.5 text-2xs text-warning-foreground">
      <Icon name="danger-triangle" size="sm" />
      {what} may be hard to read (contrast {contrastBetween(a, b).toFixed(1)}:1, aim for {MIN_BUTTON_CONTRAST}:1).
    </p>
  );
}

const SHADOW_CLASS = { none: "", soft: "shadow-sm", strong: "shadow-float" } as const;

/** A tiny card in the preset's look, with the owner's own brand colour on the play button. */
function PresetSwatch({ preset, primaryColor }: { preset: StylePreset; primaryColor: string }) {
  const t = preset.theme;
  const mode = WIDGET_MODE_COLOURS[t.mode];
  const text = t.textColor ?? mode.text;
  return (
    <span className={cn("relative flex h-14 w-full items-center justify-center overflow-hidden rounded-control", t.glass ? "bg-gradient-to-br from-tint-pink to-tint-lime" : "bg-surface-sunken")} aria-hidden>
      <span
        className={cn("flex w-4/5 items-center gap-1.5 p-1.5", SHADOW_CLASS[t.shadow], t.glass && "backdrop-blur")}
        style={{
          background: t.glass ? `color-mix(in srgb, ${t.background ?? mode.background} 70%, transparent)` : (t.background ?? mode.background),
          border: t.borderWidth ? `${t.borderWidth}px solid ${t.borderColor ?? AUTO_BORDER_PREVIEW[t.mode]}` : "none",
          borderRadius: Math.min(t.borderRadius, 14),
        }}
      >
        <span className="size-4 shrink-0" style={{ background: primaryColor, borderRadius: t.playButtonStyle === "solid" ? 3 : 999 }} />
        <span className="flex flex-1 flex-col gap-1">
          <span className="h-1 w-3/4 rounded-pill opacity-80" style={{ background: text }} />
          <span className="h-1 w-1/2 rounded-pill opacity-40" style={{ background: text }} />
        </span>
      </span>
    </span>
  );
}

function PresetPicker({ theme, updateTheme, lastPresetId, onPreset }: { theme: Theme; updateTheme: UpdateTheme; lastPresetId: string | null; onPreset: (id: string) => void }) {
  const active = matchingPreset(theme);
  const last = STYLE_PRESETS.find((p) => p.id === lastPresetId);
  const label = active ? active.name : last ? `${last.name} (edited)` : "Custom";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text">Start from a look</span>
        <span className="text-2xs text-text-muted">{label}</span>
      </div>
      <div role="radiogroup" aria-label="Looks" className="grid grid-cols-3 gap-2">
        {STYLE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={active?.id === p.id}
            title={p.description}
            onClick={() => {
              updateTheme(applyPreset(theme, p));
              onPreset(p.id);
            }}
            className={cn("space-y-1 rounded-card border p-1.5 text-left transition-colors", toggleStyle("choice", active?.id === p.id))}
          >
            <PresetSwatch preset={p} primaryColor={theme.primaryColor} />
            <span className="block truncate px-0.5 text-2xs font-medium text-text">{p.name}</span>
          </button>
        ))}
      </div>
      <p className="text-2xs text-text-muted">A look changes surfaces, corners and motion. Your brand colours stay.</p>
    </div>
  );
}

export function StyleSection({
  theme,
  updateTheme,
  brandManaged,
  brandHref,
  lastPresetId = null,
  onPreset = () => {},
}: {
  theme: Theme;
  updateTheme: UpdateTheme;
  brandManaged: boolean;
  brandHref?: string;
  lastPresetId?: string | null;
  onPreset?: (id: string) => void;
}) {
  const mode = WIDGET_MODE_COLOURS[theme.mode];
  return (
    <>
      <PresetPicker theme={theme} updateTheme={updateTheme} lastPresetId={lastPresetId} onPreset={onPreset} />
      <div className="h-px bg-border" />
      <Segmented label="Mode" value={theme.mode} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} onChange={(mode) => updateTheme({ mode })} />
      {brandManaged ? (
        <BrandNote href={brandHref} />
      ) : (
        <>
          <ColorControl label="Brand colour" value={theme.primaryColor} fallback={theme.primaryColor} swatches={PRIMARY_COLOR_PRESETS} onChange={(primaryColor) => updateTheme({ primaryColor }, "primaryColor")} />
          <ColorControl label="Text on brand colour" value={theme.accentColor} fallback={theme.accentColor} swatches={ACCENT_COLOR_PRESETS} onChange={(accentColor) => updateTheme({ accentColor }, "accentColor")} />
          <ContrastWarning a={theme.primaryColor} b={theme.accentColor} what="Text on the brand colour" />
        </>
      )}
      <ColorControl label="Card background" value={theme.background} fallback={mode.background} onChange={(background) => updateTheme({ background }, "background")} onClear={() => updateTheme({ background: null })} />
      <ColorControl label="Text" value={theme.textColor} fallback={mode.text} onChange={(textColor) => updateTheme({ textColor }, "textColor")} onClear={() => updateTheme({ textColor: null })} />
      <ContrastWarning a={theme.background ?? mode.background} b={theme.textColor} what="Text on the card background" />
      <Segmented label="Shadow" value={theme.shadow} options={[{ value: "none", label: "None" }, { value: "soft", label: "Soft" }, { value: "strong", label: "Strong" }]} onChange={(shadow) => updateTheme({ shadow })} />
      <SliderControl label="Border" value={theme.borderWidth} min={0} max={4} unit="px" onChange={(borderWidth) => updateTheme({ borderWidth }, "borderWidth")} />
      {theme.borderWidth > 0 && (
        <ColorControl label="Border colour" value={theme.borderColor} fallback={AUTO_BORDER_PREVIEW[theme.mode]} onChange={(borderColor) => updateTheme({ borderColor }, "borderColor")} onClear={() => updateTheme({ borderColor: null })} />
      )}
      <SwitchRow label="Frosted glass" hint="Translucent cards that blur the page behind them." checked={theme.glass} onChange={(glass) => updateTheme({ glass })} />
    </>
  );
}

export const SHAPE_LABELS: Record<WidgetShape, string> = {
  circle: "Circle",
  square: "Square",
  rounded: "Rounded",
  landscape: "Wide",
  portrait: "Portrait",
  vertical: "Reel",
};

/** The outline of each shape, drawn small so the choice is visual. */
const SHAPE_SKETCH: Record<WidgetShape, string> = {
  circle: "size-5 rounded-pill",
  square: "size-5 rounded-none",
  rounded: "size-5 rounded-[6px]",
  landscape: "h-4 w-7 rounded-[2px]",
  portrait: "h-6 w-5 rounded-[2px]",
  vertical: "h-7 w-4 rounded-[3px]",
};

export function ShapeSection({ theme, updateTheme, brandManaged, template }: { theme: Theme; updateTheme: UpdateTheme; brandManaged: boolean; template: WidgetTemplate }) {
  const shapes = layoutInfo(template).shapes;
  // The layout's own look is stored as null ("Default"), so it follows the layout if that changes
  const current = theme.shape ?? shapes[0];
  return (
    <>
      {shapes.length > 0 && (
        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-text">Shape of each video</span>
          <div role="radiogroup" aria-label="Shape" className="grid grid-cols-3 gap-2">
            {shapes.map((shape, i) => (
              <button
                key={shape}
                type="button"
                role="radio"
                aria-checked={current === shape}
                onClick={() => updateTheme({ shape: i === 0 ? null : shape })}
                className={cn("flex flex-col items-center gap-1.5 rounded-card border px-2 py-2.5 text-2xs font-medium transition-colors", toggleStyle("choice", current === shape))}
              >
                <span className="flex h-7 items-center" aria-hidden>
                  <span className={cn("border-2 border-current bg-brand-soft text-brand", SHAPE_SKETCH[shape])} />
                </span>
                {SHAPE_LABELS[shape]}
                {i === 0 && <span className="-mt-1 text-3xs font-normal text-text-muted">Default</span>}
              </button>
            ))}
          </div>
        </div>
      )}
      <Segmented label="Size" value={theme.size} options={[{ value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }]} onChange={(size) => updateTheme({ size })} />
      {brandManaged ? (
        <p className="text-2xs text-text-muted">Corner radius comes from your Brand settings.</p>
      ) : (
        <SliderControl label="Corner radius" value={theme.borderRadius} min={0} max={48} unit="px" onChange={(borderRadius) => updateTheme({ borderRadius }, "borderRadius")} />
      )}
    </>
  );
}

export function ContentSection({ theme, updateTheme, template }: { theme: Theme; updateTheme: UpdateTheme; template: WidgetTemplate }) {
  const layout = layoutInfo(template);
  return (
    <>
      <div className="space-y-3">
        <SwitchRow label="Name" checked={theme.showName} onChange={(showName) => updateTheme({ showName })} />
        <SwitchRow label="Company" checked={theme.showCompany} onChange={(showCompany) => updateTheme({ showCompany })} />
        <SwitchRow label="Quote" checked={theme.showQuote} onChange={(showQuote) => updateTheme({ showQuote })} />
        <SwitchRow label="Star ratings" checked={theme.showStars} onChange={(showStars) => updateTheme({ showStars })} />
        <SwitchRow label="Source badge" hint="Google, Trustpilot or video label." checked={theme.showSource} onChange={(showSource) => updateTheme({ showSource })} />
      </div>
      <Segmented label="Play button" value={theme.playButtonStyle} options={[{ value: "circle", label: "Circle" }, { value: "solid", label: "Solid" }, { value: "minimal", label: "Minimal" }]} onChange={(playButtonStyle) => updateTheme({ playButtonStyle })} />
      {layout.grid && (
        <>
          <SliderControl label="Columns, at most" value={theme.columns} min={1} max={4} onChange={(columns) => updateTheme({ columns }, "columns")} />
          <Segmented label="Spacing" value={theme.gap} options={[{ value: "tight", label: "Tight" }, { value: "normal", label: "Normal" }, { value: "loose", label: "Loose" }]} onChange={(gap) => updateTheme({ gap })} />
        </>
      )}
      {layout.autoAdvance && (
        <SliderControl label={theme.autoAdvance === 0 ? "Auto-scroll: off" : "Auto-scroll every"} value={theme.autoAdvance} min={0} max={15} unit={theme.autoAdvance === 0 ? "" : "s"} onChange={(autoAdvance) => updateTheme({ autoAdvance }, "autoAdvance")} />
      )}
      <Segmented
        label="Entrance"
        value={theme.entrance}
        options={[{ value: "none", label: "None" }, { value: "fade", label: "Fade" }, { value: "slide", label: "Slide" }, { value: "pop", label: "Pop" }]}
        onChange={(entrance) => updateTheme({ entrance })}
      />
    </>
  );
}

export function BehaviourSection({ config, update }: { config: UpdateWidgetConfigInput; update: (patch: Partial<UpdateWidgetConfigInput>, key?: string) => void }) {
  const floating = layoutInfo(config.template).placement === "floating";
  return (
    <>
      {floating && <PositionPicker compact value={config.position} onChange={(position) => update({ position })} />}
      <TriggerConfig compact triggerType={config.triggerType} triggerValue={config.triggerValue} onChange={(triggerType, triggerValue) => update({ triggerType, triggerValue }, "trigger")} />
      <PageTargeting compact pagesIncluded={config.pagesIncluded} pagesExcluded={config.pagesExcluded} onChange={(pagesIncluded, pagesExcluded) => update({ pagesIncluded, pagesExcluded }, "targeting")} />
      <SwitchRow label="Autoplay video previews" hint="A muted loop plays in the player to catch attention." checked={config.autoplayPreview} onChange={(autoplayPreview) => update({ autoplayPreview })} />
    </>
  );
}

/** The spot an inline widget goes in. Placing by id works for every widget, whichever it is in the space. */
export const widgetSpot = (widgetId: string) => `<div data-vouchreel-widget="${widgetId}"></div>`;

export function InstallSection({ spaceId, embedKey, template, widgetId, wallEnabled = false }: { spaceId: string; embedKey: string; template: WidgetTemplate; widgetId: string; wallEnabled?: boolean }) {
  const inline = layoutInfo(template).placement === "inline";
  return (
    <>
      {inline ? (
        <div className="space-y-2">
          <CopyField label="1. Where it goes" value={widgetSpot(widgetId)} />
          <p className="text-2xs text-text-muted">
            This layout sits in your page, not in a corner. Put this where it should appear. Pages that already use <code className="font-mono">data-vouchreel-embed</code> keep working for your first widget.
          </p>
        </div>
      ) : (
        <p className="rounded-card bg-surface-sunken p-3 text-2xs text-text-muted">This layout floats in a corner of the page, so it needs no spot. Just add the script.</p>
      )}
      <p className="text-2xs text-text-muted">{inline ? "2. " : ""}The script is the same for every widget in this space: add it once to each page.</p>
      {embedKey ? <EmbedSnippet compact embedKey={embedKey} /> : <div className="h-32 animate-pulse rounded-card bg-surface-sunken" />}
      {inline && <WallShare spaceId={spaceId} widgetId={widgetId} initialEnabled={wallEnabled} />}
      <InstallCheck spaceId={spaceId} widgetId={widgetId} />
    </>
  );
}
