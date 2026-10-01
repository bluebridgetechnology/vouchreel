import { cn } from "@/lib/utils";

/** Selected / unselected colour sets for hand-laid selectable controls
 *  (segmented buttons, tab underlines, option cards, colour swatches). Layout, size
 *  and radius stay with the caller; this only supplies the state colours. */
const styles = {
  /** Segmented control, filled when active */
  solid: {
    on: "bg-brand text-text-on-accent shadow-xs",
    off: "text-text-muted hover:bg-surface-sunken hover:text-text",
  },
  /** Segmented control on a sunken track, raised when active */
  raised: {
    on: "bg-surface text-text shadow-xs",
    off: "text-text-muted hover:text-text",
  },
  /** Selectable option card */
  choice: {
    on: "border-brand bg-brand-soft/60 text-text ring-2 ring-brand/20",
    off: "border-border hover:border-border-strong hover:bg-surface-sunken",
  },
  /** Underline tab */
  tab: {
    on: "border-brand text-brand",
    off: "border-transparent text-text-muted hover:text-text",
  },
  /** Colour swatch */
  swatch: {
    on: "scale-110 ring-2 ring-brand ring-offset-1 ring-offset-surface",
    off: "hover:scale-105",
  },
} as const;

export type ToggleKind = keyof typeof styles;

export function toggleStyle(kind: ToggleKind, active: boolean, className?: string) {
  return cn(styles[kind][active ? "on" : "off"], className);
}
