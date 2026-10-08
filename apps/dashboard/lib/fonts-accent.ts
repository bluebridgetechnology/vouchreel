import localFont from "next/font/local";

// Editorial accent face. Italic only, and only imported by the marketing and
// style-guide layouts so the dashboard never downloads it. Shipped with the app, not fetched from Google.
export const fontAccent = localFont({
  src: [{ path: "./fonts/playfair-display-latin-400-italic.woff2", weight: "400", style: "italic" }],
  variable: "--font-playfair",
  display: "swap",
});
