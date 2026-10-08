import type { WidgetThemeConfig } from "./widget";

/** Theme fields that become CSS custom properties on the themed root. */
const VARS: [key: string, cssVar: string, unit?: string][] = [
  ["primaryColor", "--vr-primary"],
  ["accentColor", "--vr-accent"],
  ["borderRadius", "--vr-radius", "px"],
  ["background", "--vr-bg"],
  ["background", "--vr-sheet-bg"],
  ["textColor", "--vr-text"],
  ["borderColor", "--vr-border"],
  ["borderWidth", "--vr-border-w", "px"],
  ["columns", "--vr-cols"],
];

/** Theme fields that become a `vr-<prefix>-<value>` class; the stylesheet does the rest. */
const CLASSES: Record<string, string> = {
  size: "size",
  shadow: "shadow",
  shape: "shape",
  gap: "gap",
  entrance: "enter",
  playButtonStyle: "play",
};

/** Content toggles: `false` adds `vr-hide-<thing>`. */
const TOGGLES = ["Name", "Company", "Stars", "Source", "Quote"];

/**
 * Applies a widget theme to the themed root. Every option is a variable or a class, so the renderer
 * code never branches on appearance and an option costs a few bytes. Values come from our API, but an
 * experiment's config can carry them too, so anything that is not a plain token is ignored.
 */
export function applyTheme(root: HTMLElement, theme: WidgetThemeConfig | undefined): void {
  if (!theme) return;
  for (const [key, cssVar, unit] of VARS) {
    const value = theme[key];
    if (typeof value === "number" || (typeof value === "string" && value)) {
      root.style.setProperty(cssVar, `${value}${unit || ""}`);
    }
  }
  if (typeof theme.textColor === "string" && theme.textColor) {
    root.style.setProperty("--vr-text-muted", `color-mix(in srgb, ${theme.textColor} 65%, var(--vr-bg))`);
  }
  const add = (name: string) => /^[a-zA-Z-]+$/.test(name) && root.classList.add(`vr-${name}`);
  for (const key in CLASSES) {
    if (typeof theme[key] === "string") add(`${CLASSES[key]}-${theme[key]}`);
  }
  for (const thing of TOGGLES) {
    if (theme[`show${thing}`] === false) add(`hide-${thing.toLowerCase()}`);
  }
  if (theme.glass === true) add("glass");
  if (theme.mode === "dark") add("dark");
}
