/**
 * The widget's own surface, text and border colours in light and dark mode, so the editor can show what
 * "Auto" means and check contrast. Mirrors the token blocks in packages/widget/src/styles.css; a test keeps
 * them in step.
 */
export const WIDGET_MODE_COLOURS = {
  light: { background: "#ffffff", text: "#1c1917" },
  dark: { background: "#1c1917", text: "#f5f5f4" },
} as const;

/** Shown in the border picker while the border colour is Auto (the widget's border is a translucent tint). */
export const AUTO_BORDER_PREVIEW = { light: "#e7e5e4", dark: "#3a3532" } as const;
