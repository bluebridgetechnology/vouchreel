/** Neutral palette for exported reports (HTML print view and PDF). Reports leave the
 *  app, so they cannot use CSS variables; these hex values mirror the warm "ink"
 *  palette in app/globals.css. The accent colour is the space's brand colour. */
export const REPORT_PALETTE = {
  canvas: "#faf9f7",
  surface: "#ffffff",
  sunken: "#f5f3f0",
  border: "#e7e3de",
  borderStrong: "#d6d0c9",
  text: "#1c1917",
  textMuted: "#78716c",
  textSubtle: "#a8a29e",
  danger: "#dc2626",
} as const;
